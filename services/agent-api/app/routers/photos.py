from typing import Optional, Dict, Any, List
from datetime import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from firebase_admin import firestore as admin_firestore
from pydantic import BaseModel, Field, field_validator
from google.cloud import firestore
from google.cloud.exceptions import GoogleCloudError

from ..services.gemini_vision import analyze_image_bytes
from ..auth import get_current_uid
from ..firebase import get_firestore_client
from ..storage import download_image_bytes, validate_storage_path
from ..middleware.rate_limit import limiter

router = APIRouter(prefix="/api/v1/photos", tags=["photos"])


def _assert_photo_path(uid: str, storage_path: str) -> None:
    """
    Validate that the storage path is owned by the user and is for photo images.

    Args:
        uid: The user ID
        storage_path: The storage path to validate

    Raises:
        HTTPException: If the path is invalid or not owned by the user
    """
    # Basic validation (path traversal, extension, etc.)
    validate_storage_path(storage_path)

    # Owner validation: must be under users/{uid}/photos/
    if not storage_path.startswith(f"users/{uid}/photos/"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid storage path: must be under users/{uid}/photos/"
        )


class AnalyzePhotoRequest(BaseModel):
    photoId: str = Field(..., min_length=1, max_length=100, pattern="^[a-zA-Z0-9_-]+$", description="Photo ID to analyze")

    @field_validator('photoId')
    @classmethod
    def validate_photo_id(cls, v: str) -> str:
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
@limiter.limit("5/minute")  # Rate limit: 5 requests per minute
def analyze_photo(
    request: Request,
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

    # Validate storage path ownership (IDOR protection)
    _assert_photo_path(uid, storage_path)

    # 2. Download Image
    try:
        image_bytes = download_image_bytes(storage_path)
    except ValueError as exc:
        # Path validation failed (e.g., path traversal attempt)
        logging.warning(f"Invalid storage path detected: {storage_path}")
        # Do not expose internal validation details to prevent information leakage
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid storage path"
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

    # Fetch User Profile for Gender
    profile_ref = db.collection("users").document(uid).collection("profile").document("default")
    profile_snap = profile_ref.get()
    gender = "prefer-not-to-say"
    if profile_snap.exists:
        profile_data = profile_snap.to_dict()
        raw_gender = profile_data.get("gender")
        if raw_gender in ["male", "female", "prefer-not-to-say"]:
            gender = raw_gender

    # 3. Analyze Image
    result = analyze_image_bytes(image_bytes, gender=gender)
    
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
@limiter.limit("100/minute")  # Rate limit: 100 requests per minute
def get_analysis_history(
    request: Request,
    uid: str = Depends(get_current_uid),
    limit: int = Query(default=50, ge=1, le=200, description="Maximum number of analysis results to return (1-200)")
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

class AnalyzeScanRequest(BaseModel):
    frontPhotoId: str
    topPhotoId: str
    sidePhotoId: str
    deviceType: str = "pc"


@router.post("/analyze-scan", response_model=AnalyzePhotoResponse)
@limiter.limit("5/minute")
def analyze_scan_photos(
    request: Request,
    payload: AnalyzeScanRequest,
    uid: str = Depends(get_current_uid)
) -> AnalyzePhotoResponse:
    """
    Analyzes 3 images (Front, Top, Side) for integrated diagnosis.
    """
    db = get_firestore_client()
    
    # helper to fetch and download
    def get_image_data(photo_id: str):
        ref = db.collection("users").document(uid).collection("photos").document(photo_id)
        snap = ref.get()
        if not snap.exists:
            raise HTTPException(status_code=404, detail=f"Photo {photo_id} not found")
        data = snap.to_dict()
        path = data.get("storagePath")
        if not path:
            raise HTTPException(status_code=400, detail=f"Photo {photo_id} missing storagePath")
        # Validate storage path ownership (IDOR protection)
        _assert_photo_path(uid, path)
        return download_image_bytes(path)

    try:
        # Download all 3 in parallel (or sequential is fine for now to keep simple)
        front_bytes = get_image_data(payload.frontPhotoId)
        top_bytes = get_image_data(payload.topPhotoId)
        side_bytes = get_image_data(payload.sidePhotoId)
    except HTTPException:
        # Re-raise HTTPException to preserve status code (e.g., 403, 404)
        raise
    except Exception as e:
        logging.error(f"Failed to download scan images: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve images")

    # Fetch Gender
    profile_ref = db.collection("users").document(uid).collection("profile").document("default")
    profile_snap = profile_ref.get()
    gender = "prefer-not-to-say"
    if profile_snap.exists:
        gender = profile_snap.to_dict().get("gender", gender)

    # Analyze
    from ..services.gemini_vision import analyze_scan_images
    result = analyze_scan_images(
        front_bytes=front_bytes,
        top_bytes=top_bytes,
        side_bytes=side_bytes,
        gender=gender,
        device_type=payload.deviceType
    )

    # Save Result (Use Top Photo ID as the main key for now)
    analysis_ref = db.collection("users").document(uid).collection("analysisResults").document(payload.topPhotoId)
    
    analysis_data = {
        "photoId": payload.topPhotoId,
        "analyzedAt": admin_firestore.SERVER_TIMESTAMP,
        "score": result.score,
        "notes": result.notes,
        "hairType": result.hairType,
        "pattern": result.pattern,
        "quality": result.quality,
        "scalpCondition": result.scalpCondition,
        "delta": 0.0, # TODO: Calculate delta if needed
        "version": "v1-scan-integrated",
        "scanData": {
            "front": payload.frontPhotoId,
            "side": payload.sidePhotoId
        }
    }
    analysis_ref.set(analysis_data)
    
    return AnalyzePhotoResponse(
        analysisId=payload.topPhotoId,
        photoId=payload.topPhotoId,
        result={
            "score": result.score,
            "notes": result.notes,
            "hairType": result.hairType,
            "pattern": result.pattern,
            "quality": result.quality,
            "scalpCondition": result.scalpCondition,
            "delta": 0.0
        }
    )
