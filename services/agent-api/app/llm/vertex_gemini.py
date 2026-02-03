import re
import json
from typing import Any

from google import genai
from google.genai.types import HttpOptions

from ..config import (
    GEMINI_ENABLED,
    GEMINI_MODEL,
    GOOGLE_CLOUD_LOCATION,
    GOOGLE_CLOUD_PROJECT,
    GOOGLE_GENAI_USE_VERTEXAI,
)

USE_VERTEXAI = GOOGLE_GENAI_USE_VERTEXAI

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if USE_VERTEXAI:
            _client = genai.Client(
                vertexai=True,
                project=GOOGLE_CLOUD_PROJECT,
                location=GOOGLE_CLOUD_LOCATION,
                http_options=HttpOptions(api_version="v1"),
            )
        else:
            _client = genai.Client(http_options=HttpOptions(api_version="v1"))
    return _client


def gemini_enabled() -> bool:
    return GEMINI_ENABLED and bool(GEMINI_MODEL)


def generate_text(prompt: str, model: str | None = None) -> str:
    client = _get_client()
    selected_model = model or GEMINI_MODEL
    response = client.models.generate_content(model=selected_model, contents=prompt)
    return response.text or ""


def extract_json(text: str) -> dict[str, Any]:
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError("No JSON object found in response")
    return json.loads(match.group(0))
