from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import firestore as admin_firestore
from pydantic import BaseModel
from google.cloud import firestore

from ..services.gemini_vision import analyze_image_bytes
from ..auth import get_current_uid
from ..firebase import get_firestore_client
from ..storage import download_image_bytes

router = APIRouter(prefix="/api/v1/photos", tags=["photos"])


class AnalyzePhotoRequest(BaseModel):
    photoId: str


class AnalyzePhotoResponse(BaseModel):
    analysisId: str
    photoId: str
    result: Dict[str, Any]


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
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to retrieve image from storage"
        ) from exc

    # 3. Analyze Image
    result = analyze_image_bytes(image_bytes)

    # Fetch previous result for delta calculation
    previous_score = 0.0
    results_ref = db.collection("users").document(uid).collection("analysisResults")
    # Get latest analysis before this one
    previous_docs = results_ref.order_by("analyzedAt", direction=admin_firestore.Query.DESCENDING).limit(1).get()
    if previous_docs:
        previous_data = previous_docs[0].to_dict()
        previous_score = float(previous_data.get("score", 0.0))
    
    delta_vs_prev = f"{result.score - previous_score:+.1f}" if previous_score > 0 else "---"
    
    # 4. Save Result
    analysis_ref = db.collection("users").document(uid).collection("analysisResults").document(payload.photoId)
    
    analysis_data = {
        "photoId": payload.photoId,
        "analyzedAt": admin_firestore.SERVER_TIMESTAMP,
        "score": result.score,
        "notes": result.notes,
        "hairType": result.hairType,
        "pattern": result.pattern,
        "quality": result.quality,
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
            "notes": result.notes,
            "hairType": result.hairType,
            "pattern": result.pattern,
            "quality": result.quality,
            "deltaVsPrev": delta_vs_prev
        }
    )


class AnalysisHistoryItem(BaseModel):
    analysisId: str
    photoId: str
    score: int
    analyzedAt: str  # ISO format
    notes: Optional[str] = None


class AnalysisHistoryResponse(BaseModel):
    items: list[AnalysisHistoryItem]


@router.get("/history", response_model=AnalysisHistoryResponse)
def get_analysis_history(
    limit: int = 20,
    uid: str = Depends(get_current_uid)
) -> AnalysisHistoryResponse:
    """
    Fetches the history of analysis results for the current user.
    Ordered by analyzedAt descending.
    """
    db = get_firestore_client()
    
    # Query analysisResults subcollection
    results_ref = db.collection("users").document(uid).collection("analysisResults")
    query = results_ref.order_by("analyzedAt", direction=firestore.Query.DESCENDING).limit(limit)
    
    docs = query.stream()
    
    items = []
    for doc in docs:
        data = doc.to_dict()
        analyzed_at = data.get("analyzedAt")
        
        # Handle timestamp conversion
        if hasattr(analyzed_at, "isoformat"):
            analyzed_at_str = analyzed_at.isoformat()
        else:
            analyzed_at_str = str(analyzed_at)

        items.append(AnalysisHistoryItem(
            analysisId=doc.id,
            photoId=data.get("photoId", ""),
            score=data.get("score", 0),
            analyzedAt=analyzed_at_str,
            notes=data.get("notes")
        ))
        
    return AnalysisHistoryResponse(items=items)
