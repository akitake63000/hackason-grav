from typing import Optional, Dict, Any, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import firestore as admin_firestore
from pydantic import BaseModel, Field, validator
from google.cloud import firestore

from ..services.gemini_vision import analyze_image_bytes
from ..auth import get_current_uid
from ..firebase import get_firestore_client
from ..storage import download_image_bytes

router = APIRouter(prefix="/api/v1/photos", tags=["photos"])


class AnalyzePhotoRequest(BaseModel):
    photoId: str = Field(..., min_length=1, max_length=100, pattern="^[a-zA-Z0-9_-]+$", description="Photo ID to analyze")

    @validator('photoId')
    def validate_photo_id(cls, v):
        if not v.strip():
            raise ValueError('Photo ID cannot be empty or whitespace only')
        return v.strip()


class AnalyzePhotoResponse(BaseModel):
    analysisId: str
    photoId: str
    result: Dict[str, Any]


class AnalysisHistoryItem(BaseModel):
    photoId: str
    score: float
    notes: str
    analyzedAt: str
    capturedAt: str
    downloadUrl: str


class AnalysisHistoryResponse(BaseModel):
    items: List[AnalysisHistoryItem]
    total: int


@router.post("/analyze", response_model=AnalyzePhotoResponse)
def analyze_photo(
    payload: AnalyzePhotoRequest, 
    uid: str = Depends(get_current_uid)
) -> AnalyzePhotoResponse:
    """
    Analyzes a specific photo using Gemini Vision.
    1. Fetches photo metadata from Firestore (users/{uid}/photos/{photoId}).
    2. Downloads image from Storage.
    3. Calls Gemini Vision.
    4. Saves result to Firestore (users/{uid}/analysisResults/{photoId}).
    """
    db = get_firestore_client()
    
    # 1. Fetch Photo Metadata
    photo_ref = db.collection("users").document(uid).collection("photos").document(payload.photoId)
    photo_snap = photo_ref.get()
    
    if not photo_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Photo {payload.photoId} not found"
        )
        
    photo_data = photo_snap.to_dict()
    storage_path = photo_data.get("storagePath")
    
    if not storage_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo metadata missing storagePath"
        )

    # 2. Download Image
    try:
        image_bytes = download_image_bytes(storage_path)
    except ValueError as exc:
        # Path validation failed (e.g., path traversal attempt)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve image from storage"
        ) from exc

    # 3. Analyze Image
    result = analyze_image_bytes(image_bytes)
    
    # 4. Save Result
    analysis_ref = db.collection("users").document(uid).collection("analysisResults").document(payload.photoId)
    
    analysis_data = {
        "photoId": payload.photoId,
        "analyzedAt": admin_firestore.SERVER_TIMESTAMP,
        "score": result.score,
        "notes": result.notes,
        "version": "v1-gemini-1.5-flash"
    }
    
    analysis_ref.set(analysis_data)
    
    # 5. Update Photo status (optional but good practice)
    photo_ref.update({"status": "analyzed"})

    return AnalyzePhotoResponse(
        analysisId=payload.photoId, # Using photoId as ID for 1:1 mapping
        photoId=payload.photoId,
        result={
            "score": result.score,
            "notes": result.notes
        }
    )


@router.get("/analysis-history", response_model=AnalysisHistoryResponse)
def get_analysis_history(
    uid: str = Depends(get_current_uid),
    limit: Optional[int] = 50
) -> AnalysisHistoryResponse:
    """
    Fetches analysis history for the authenticated user.
    Returns analysis results with photo metadata, sorted by analysis date (newest first).
    """
    db = get_firestore_client()

    # Fetch all analysisResults for the user
    analysis_results_ref = (
        db.collection("users")
        .document(uid)
        .collection("analysisResults")
        .order_by("analyzedAt", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )

    analysis_docs = analysis_results_ref.stream()

    items = []

    for analysis_doc in analysis_docs:
        analysis_data = analysis_doc.to_dict()
        photo_id = analysis_data.get("photoId")

        if not photo_id:
            continue

        # Fetch corresponding photo metadata
        photo_ref = db.collection("users").document(uid).collection("photos").document(photo_id)
        photo_snap = photo_ref.get()

        if not photo_snap.exists:
            continue

        photo_data = photo_snap.to_dict()

        # Extract timestamps
        analyzed_at = analysis_data.get("analyzedAt")
        captured_at = photo_data.get("capturedAt")

        # Convert Firestore timestamps to ISO strings
        analyzed_at_str = ""
        if analyzed_at:
            if hasattr(analyzed_at, 'isoformat'):
                analyzed_at_str = analyzed_at.isoformat()
            else:
                analyzed_at_str = str(analyzed_at)

        captured_at_str = ""
        if captured_at:
            if hasattr(captured_at, 'isoformat'):
                captured_at_str = captured_at.isoformat()
            else:
                captured_at_str = str(captured_at)

        items.append(
            AnalysisHistoryItem(
                photoId=photo_id,
                score=analysis_data.get("score", 0.0),
                notes=analysis_data.get("notes", ""),
                analyzedAt=analyzed_at_str,
                capturedAt=captured_at_str,
                downloadUrl=photo_data.get("downloadUrl", "")
            )
        )

    return AnalysisHistoryResponse(
        items=items,
        total=len(items)
    )
