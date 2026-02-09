import os
import re
from pathlib import Path

from google.cloud import storage as gcs

from .config import (
    ALLOWED_STORAGE_EXTENSIONS,
    ALLOWED_STORAGE_PATH_PATTERNS,
    FIREBASE_STORAGE_BUCKET,
    LOCAL_IMAGE_PATH,
)

_storage_client: gcs.Client | None = None


def get_storage_client() -> gcs.Client:
    global _storage_client
    if _storage_client is None:
        _storage_client = gcs.Client()
    return _storage_client


def validate_storage_path(storage_path: str) -> None:
    """
    Validate storage path to prevent path traversal attacks.

    Args:
        storage_path: The storage path to validate

    Raises:
        ValueError: If the path is invalid or contains malicious patterns
    """
    # 1. Check for path traversal patterns
    if ".." in storage_path:
        raise ValueError("Invalid storage path: path traversal detected (..)")

    if storage_path.startswith("/"):
        raise ValueError("Invalid storage path: absolute path not allowed")

    # 2. Check file extension
    allowed_extensions = [ext.strip() for ext in ALLOWED_STORAGE_EXTENSIONS.split(",")]
    file_ext = storage_path.split(".")[-1].lower()

    if file_ext not in allowed_extensions:
        raise ValueError(
            f"Invalid storage path: file extension '{file_ext}' not allowed. "
            f"Allowed: {', '.join(allowed_extensions)}"
        )

    # 3. Check against allowed path patterns
    patterns = [p.strip() for p in ALLOWED_STORAGE_PATH_PATTERNS.split(",") if p.strip()]

    if not patterns:
        # If no patterns configured, skip pattern validation
        return

    for pattern in patterns:
        try:
            if re.match(pattern, storage_path):
                return  # Valid path found
        except re.error as e:
            # Invalid regex pattern in configuration
            raise ValueError(f"Invalid regex pattern in configuration: {e}") from e

    # No pattern matched
    raise ValueError(
        f"Invalid storage path format: '{storage_path}' does not match any allowed patterns"
    )


def download_image_bytes(storage_path: str) -> bytes:
    """
    Download image bytes from Firebase Storage.

    Args:
        storage_path: The storage path (e.g., "users/{uid}/photos/{photoId}.jpg")

    Returns:
        Image bytes

    Raises:
        ValueError: If the storage path is invalid or malicious
        RuntimeError: If Firebase Storage is not configured
    """
    # Validate storage path to prevent path traversal attacks
    validate_storage_path(storage_path)

    if LOCAL_IMAGE_PATH and os.path.exists(LOCAL_IMAGE_PATH):
        with open(LOCAL_IMAGE_PATH, "rb") as f:
            return f.read()

    if not FIREBASE_STORAGE_BUCKET:
        raise RuntimeError("FIREBASE_STORAGE_BUCKET is not set")

    client = get_storage_client()
    bucket = client.bucket(FIREBASE_STORAGE_BUCKET)
    blob = bucket.blob(storage_path)
    return blob.download_as_bytes()
