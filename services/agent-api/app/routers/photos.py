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
