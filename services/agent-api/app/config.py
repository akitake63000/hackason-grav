import os


def _get_bool(key: str, default: str = "false") -> bool:
    return os.getenv(key, default).lower() == "true"


FIREBASE_STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET", "hackason-grab.firebasestorage.app")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "hackason-grab")
LOCAL_IMAGE_PATH = os.getenv("LOCAL_IMAGE_PATH", "")
DEBUG_AUTH = _get_bool("DEBUG_AUTH", "true")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")

GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT", "")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "global")
GOOGLE_GENAI_USE_VERTEXAI = _get_bool("GOOGLE_GENAI_USE_VERTEXAI", "false")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_MODEL_LIGHT = os.getenv("GEMINI_MODEL_LIGHT", "gemini-2.5-flash")
GEMINI_MODEL_HEAVY = os.getenv("GEMINI_MODEL_HEAVY", "gemini-2.5-pro")
GEMINI_MODEL_VISION = os.getenv("GEMINI_MODEL_VISION", "gemini-2.5-pro")  # For photo analysis
GEMINI_ENABLED = _get_bool("GEMINI_ENABLED", "true")
