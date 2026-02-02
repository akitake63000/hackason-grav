from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import firestore as admin_firestore
from pydantic import BaseModel

from ..analysis.hair_density import compute_density_index
from ..auth import get_current_uid
from ..firebase import get_firestore_client
from ..storage import download_image_bytes

router = APIRouter(prefix="/api/v1/photos", tags=["photos"])


class AnalyzePhotoRequest(BaseModel):
    photoId: str
    storagePath: str
    capturedAt: Optional[str] = None
    roiPreset: Optional[str] = None


class QualityInfo(BaseModel):
    score: float
    warnings: List[str]


class AnalyzePhotoResponse(BaseModel):
    densityIndex: float
    deltaVsPrev: float
    deltaVsBase: float
    quality: QualityInfo
    analysisId: str


@router.post("/analyze", response_model=AnalyzePhotoResponse)
def analyze_photo(
    payload: AnalyzePhotoRequest, uid: str = Depends(get_current_uid)
) -> AnalyzePhotoResponse:
    try:
        image_bytes = download_image_bytes(payload.storagePath)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Failed to load image") from exc

    try:
        result = compute_density_index(image_bytes, payload.roiPreset)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Failed to analyze image") from exc

    db = get_firestore_client()
    analysis_collection = (
        db.collection("analysisResults").document(uid).collection("items")
    )

    prev_docs = (
        analysis_collection.order_by(
            "computedAt", direction=admin_firestore.Query.DESCENDING
        )
        .limit(1)
        .get()
    )
    base_docs = (
        analysis_collection.order_by(
            "computedAt", direction=admin_firestore.Query.ASCENDING
        )
        .limit(1)
        .get()
    )

    prev_density = None
    if prev_docs:
        prev_density = prev_docs[0].to_dict().get("densityIndex")

    base_density = None
    if base_docs:
        base_density = base_docs[0].to_dict().get("densityIndex")

    delta_vs_prev = (
        float(result.density_index - prev_density)
        if prev_density is not None
        else 0.0
    )
    delta_vs_base = (
        float(result.density_index - base_density)
        if base_density is not None
        else 0.0
    )

    analysis_id = f"analysis_{payload.photoId}"

    analysis_collection.document(analysis_id).set(
        {
            "photoId": payload.photoId,
            "computedAt": admin_firestore.SERVER_TIMESTAMP,
            "roi": result.roi,
            "densityIndex": result.density_index,
            "deltaVsPrev": delta_vs_prev,
            "deltaVsBase": delta_vs_base,
            "quality": {
                "score": result.quality.score,
                "warnings": result.quality.warnings,
            },
            "method": "pil_threshold_v1",
        }
    )

    db.collection("photos").document(uid).collection("items").document(
        payload.photoId
    ).set({"status": "done"}, merge=True)

    return AnalyzePhotoResponse(
        densityIndex=result.density_index,
        deltaVsPrev=delta_vs_prev,
        deltaVsBase=delta_vs_base,
        quality=QualityInfo(
            score=result.quality.score, warnings=result.quality.warnings
        ),
        analysisId=analysis_id,
    )
