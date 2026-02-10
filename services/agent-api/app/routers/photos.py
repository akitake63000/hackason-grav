from typing import Optional, Dict, Any, List
from datetime import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import firestore as admin_firestore
from pydantic import BaseModel, Field, validator
from google.cloud import firestore
from google.cloud.exceptions import GoogleCloudError

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
        logging.warning(f"Invalid storage path detected: {storage_path}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        ) from exc
    except GoogleCloudError as exc:
        logging.error(f"Google Cloud Storage error for path {storage_path}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve image from storage"
        ) from exc
    except Exception as exc:
        logging.error(f"Unexpected error downloading image from storage ({storage_path}): {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve image from storage"
        ) from exc

    # 3. Analyze Image
    result = analyze_image_bytes(image_bytes)
    
    # 4. Save Result
    analysis_ref = db.collection("users").document(uid).collection("analysisResults").document(payload.photoId)
    
    # Calculate Delta (Fetch latest previous result before today 00:00 JST)
    import datetime
    
    # JST Timezone
    JST = datetime.timezone(datetime.timedelta(hours=9))
    now_jst = datetime.datetime.now(JST)
    today_start_jst = now_jst.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Convert JST datetime to UTC datetime for Firestore query
    # Firestore stores timestamps in UTC.
    today_start_utc = today_start_jst.astimezone(datetime.timezone.utc)

    previous_results = (
        db.collection("users")
        .document(uid)
        .collection("analysisResults")
        .where("analyzedAt", "<", today_start_utc)
        .order_by("analyzedAt", direction=firestore.Query.DESCENDING)
        .limit(1)
        .stream()
    )
    
    delta = 0.0
    for prev_doc in previous_results:
        prev_data = prev_doc.to_dict()
        prev_score = prev_data.get("score")
        if isinstance(prev_score, (int, float)):
            delta = result.score - float(prev_score)
        break

    analysis_data = {
        "photoId": payload.photoId,
        "analyzedAt": admin_firestore.SERVER_TIMESTAMP,
        "score": result.score,
        "notes": result.notes,
        "hairType": result.hairType,
        "pattern": result.pattern,
        "quality": result.quality,
        "scalpCondition": result.scalpCondition,
        "delta": delta,
        "version": "v1-gemini-1.5-flash-personalized"
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
            "scalpCondition": result.scalpCondition,
            "delta": delta
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
    Optimized to avoid N+1 query problem by batching photo fetches.
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

    # Convert stream to list to allow multiple iterations
    analysis_docs = list(analysis_results_ref.stream())

    # Extract photo IDs and analysis data
    photo_ids = []
    analysis_data_list = []
    for analysis_doc in analysis_docs:
        analysis_data = analysis_doc.to_dict()
        photo_id = analysis_data.get("photoId")
        if photo_id:
            photo_ids.append(photo_id)
            analysis_data_list.append((photo_id, analysis_data))

    if not photo_ids:
        return AnalysisHistoryResponse(items=[], total=0)

    # Batch fetch all photos at once (avoids N+1 query)
    photos_ref = db.collection("users").document(uid).collection("photos")
    photo_refs = [photos_ref.document(photo_id) for photo_id in photo_ids]
    photo_snaps = db.get_all(photo_refs)

    # Create photo_id -> photo_data mapping
    photo_map = {}
    for photo_snap in photo_snaps:
        if photo_snap.exists:
            photo_map[photo_snap.id] = photo_snap.to_dict()

    items = []
    for photo_id, analysis_data in analysis_data_list:
        photo_data = photo_map.get(photo_id)
        if not photo_data:
            continue

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
