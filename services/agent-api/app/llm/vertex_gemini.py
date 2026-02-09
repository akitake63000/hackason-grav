import re
import json
import logging
from typing import Any

from google import genai
from google.genai.types import GenerateContentConfig, HttpOptions

from ..config import (
    GEMINI_ENABLED,
    GEMINI_MODEL,
    GOOGLE_CLOUD_LOCATION,
    GOOGLE_CLOUD_PROJECT,
    GOOGLE_GENAI_USE_VERTEXAI,
)

logger = logging.getLogger(__name__)

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


def generate_text(prompt: str, model: str | None = None, max_output_tokens: int | None = None) -> str:
    client = _get_client()
    selected_model = model or GEMINI_MODEL
    config = GenerateContentConfig(max_output_tokens=max_output_tokens) if max_output_tokens else None

    try:
        logger.info(f"Generating text with model={selected_model}, max_tokens={max_output_tokens}, prompt_length={len(prompt)}")
        response = client.models.generate_content(model=selected_model, contents=prompt, config=config)

        if not response or not hasattr(response, 'text'):
            logger.error(f"Invalid response from Gemini API: {type(response)}")
            raise RuntimeError("Invalid response from Gemini API")

        result_text = response.text or ""

        if not result_text:
            # Log full response details to debug empty response
            logger.warning(f"Empty response from Gemini API for model={selected_model}")
            logger.warning(f"Response object: {response}")
            if hasattr(response, 'candidates') and response.candidates:
                for idx, candidate in enumerate(response.candidates):
                    logger.warning(f"Candidate {idx}: finish_reason={getattr(candidate, 'finish_reason', None)}, "
                                 f"safety_ratings={getattr(candidate, 'safety_ratings', None)}")
        else:
            logger.info(f"Successfully generated text: length={len(result_text)}")

        return result_text
    except Exception as e:
        logger.error(f"Gemini API error: model={selected_model}, error={type(e).__name__}: {str(e)}", exc_info=True)
        raise


def extract_json(text: str) -> dict[str, Any]:
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError("No JSON object found in response")
    return json.loads(match.group(0))
