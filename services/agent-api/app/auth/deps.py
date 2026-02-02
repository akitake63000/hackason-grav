import logging

from fastapi import Header, HTTPException

from ..config import DEBUG_AUTH
from ..firebase import verify_id_token


def get_current_uid(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1]
    try:
        decoded = verify_id_token(token)
    except Exception as exc:  # noqa: BLE001
        logging.exception("Failed to verify Firebase ID token")
        detail = f"Invalid token: {exc}" if DEBUG_AUTH else "Invalid token"
        raise HTTPException(status_code=401, detail=detail) from exc

    uid = decoded.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    return uid
