from fastapi import APIRouter, Request, status
from datetime import datetime, timezone
import os

from ..middleware.rate_limit import limiter

router = APIRouter()


@router.get("/api/health")
@router.get("/api/v1/health")
@limiter.limit("300/minute")
def health(request: Request) -> dict:
    """
    Enhanced health check endpoint with detailed system information.
    Returns service status, version, timestamp, and environment details.
    """
    return {
        "status": "ok",
        "service": "HairGuard Agent API",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "environment": os.getenv("ENVIRONMENT", "development"),
        "checks": {
            "api": "healthy",
            "gemini": "enabled" if os.getenv("GEMINI_ENABLED", "true").lower() == "true" else "disabled",
        }
    }


@router.get("/api/v1/health/ready")
@limiter.limit("300/minute")
def readiness(request: Request) -> dict:
    """
    Readiness probe for Kubernetes/Cloud Run.
    Returns 200 if the service is ready to accept traffic.
    """
    # Add checks for dependencies here if needed
    # For now, if the service is running, it's ready
    return {"status": "ready", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/api/v1/health/live")
@limiter.limit("300/minute")
def liveness(request: Request) -> dict:
    """
    Liveness probe for Kubernetes/Cloud Run.
    Returns 200 if the service is alive (not deadlocked).
    """
    return {"status": "alive", "timestamp": datetime.now(timezone.utc).isoformat()}
