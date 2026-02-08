import os


def _get_bool(key: str, default: str = "false") -> bool:
    return os.getenv(key, default).lower() == "true"


FIREBASE_STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET", "")
FIREBASE_PROJECT_ID = "hackason-grab" # Hardcoded for debugging
LOCAL_IMAGE_PATH = os.getenv("LOCAL_IMAGE_PATH", "")
DEBUG_AUTH = True # Hardcoded for debugging

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")

GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT", "")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "global")
GOOGLE_GENAI_USE_VERTEXAI = _get_bool("GOOGLE_GENAI_USE_VERTEXAI", "false")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_MODEL_LIGHT = os.getenv("GEMINI_MODEL_LIGHT", "")
GEMINI_MODEL_HEAVY = os.getenv("GEMINI_MODEL_HEAVY", "")
GEMINI_ENABLED = _get_bool("GEMINI_ENABLED", "true")
