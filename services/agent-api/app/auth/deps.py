import logging
import os  # 追加

logging.warning(f"[AUTH DEBUG] ENV={os.getenv('ENV')}")

from fastapi import Header, HTTPException

from ..config import DEBUG_AUTH
from ..firebase import verify_id_token


def get_current_uid(
    authorization: str | None = Header(default=None),
    x_firebase_auth: str | None = Header(default=None),
) -> str:
    # ローカル開発のみ認証スキップ（ENV=local のときだけ）
    if os.getenv("ENV") == "local":
        logging.info("Auth bypass enabled (ENV=local). Returning dummy UID.")
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
