from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/lifestyle", tags=["lifestyle"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}
