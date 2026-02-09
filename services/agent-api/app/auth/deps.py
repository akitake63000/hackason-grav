import logging
import os

logging.warning(f"[AUTH DEBUG] ENV={os.getenv('ENV')}")

from fastapi import Header, HTTPException

from ..config import DEBUG_AUTH
from ..firebase import verify_id_token


def _is_local_dev() -> bool:
    """
    Check if running in local development environment.
    Requires multiple conditions to prevent accidental bypass in production.

    Returns:
        bool: True if all conditions are met for local development
    """
    is_local_env = os.getenv("ENV") == "local"
    allow_auth_skip = os.getenv("ALLOW_LOCAL_AUTH_SKIP") == "true"
    allowed_origins = os.getenv("ALLOWED_ORIGINS", "")
    has_localhost = "localhost" in allowed_origins or "127.0.0.1" in allowed_origins

    return is_local_env and allow_auth_skip and has_localhost


def get_current_uid(
    authorization: str | None = Header(default=None),
    x_firebase_auth: str | None = Header(default=None),
) -> str:
    # ローカル開発環境でのみ認証スキップ（複数条件必須）
    if _is_local_dev():
        logging.warning("[LOCAL DEV] Authentication bypassed - returning dummy UID")
        return "local-user"

    bearer = None
    if x_firebase_auth:
        bearer = x_firebase_auth
    elif authorization and authorization.startswith("Bearer "):
        bearer = authorization.split(" ", 1)[1]

    if not bearer:
        logging.warning("Missing bearer token in request headers.")
        raise HTTPException(status_code=401, detail="Missing bearer token")

    try:
        decoded = verify_id_token(bearer)
        logging.info(f"Token verified for UID: {decoded.get('uid')}")
    except Exception as exc:  # noqa: BLE001
        logging.exception("Failed to verify Firebase ID token")
        detail = f"Invalid token: {exc}" if DEBUG_AUTH else "Invalid token"
        raise HTTPException(status_code=401, detail=detail) from exc

    uid = decoded.get("uid")
    if not uid:
        logging.error("Token payload missing UID.")
        raise HTTPException(status_code=401, detail="Invalid token payload")

    return uid
