import re
import json
import logging
import time
import random
from typing import Any

from google import genai
from google.genai.types import GenerateContentConfig, HttpOptions
from google.api_core import exceptions as google_exceptions

from ..config import (
    GEMINI_ENABLED,
    GEMINI_MODEL,
    GEMINI_RETRY_MAX_ATTEMPTS,
    GEMINI_RETRY_BASE_DELAY,
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
    """
    Generate text using Gemini API with automatic retry on rate limit errors.

    Args:
        prompt: Text prompt for generation
        model: Model name (defaults to GEMINI_MODEL)
        max_output_tokens: Maximum output tokens

    Returns:
        Generated text

    Raises:
        RuntimeError: If API returns invalid response after all retries
        google_exceptions.ResourceExhausted: If rate limit exceeded after all retries
        Exception: For other API errors
    """
    client = _get_client()
    selected_model = model or GEMINI_MODEL
    config = GenerateContentConfig(max_output_tokens=max_output_tokens) if max_output_tokens else None

    last_exception = None

    for attempt in range(GEMINI_RETRY_MAX_ATTEMPTS):
        try:
            if attempt > 0:
                logger.info(f"Retry attempt {attempt + 1}/{GEMINI_RETRY_MAX_ATTEMPTS} for model={selected_model}")
            else:
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
                logger.info(f"Successfully generated text: length={len(result_text)} (attempt {attempt + 1}/{GEMINI_RETRY_MAX_ATTEMPTS})")

            return result_text

        except google_exceptions.ResourceExhausted as e:
            # Rate limit error (HTTP 429)
            last_exception = e

            if attempt < GEMINI_RETRY_MAX_ATTEMPTS - 1:
                # Exponential backoff with jitter: base_delay * (2^attempt) + random(0, 0.5)
                wait_time = GEMINI_RETRY_BASE_DELAY * (2 ** attempt) + (random.random() * 0.5)
                logger.warning(
                    f"Rate limit exceeded (429). Retrying in {wait_time:.2f}s "
                    f"(attempt {attempt + 1}/{GEMINI_RETRY_MAX_ATTEMPTS}, model={selected_model})"
                )
                time.sleep(wait_time)
            else:
                logger.error(
                    f"Rate limit exceeded after {GEMINI_RETRY_MAX_ATTEMPTS} attempts. "
                    f"Consider increasing GEMINI_RATE_LIMIT_RPM or quota in Google Cloud Console. "
                    f"Model: {selected_model}"
                )
                raise

        except Exception as e:
            # Other errors should not be retried
            logger.error(f"Gemini API error: model={selected_model}, error={type(e).__name__}: {str(e)}", exc_info=True)
            raise

    # This should never be reached, but just in case
    if last_exception:
        raise last_exception

    raise RuntimeError("Unexpected error in generate_text retry loop")


def extract_json(text: str) -> dict[str, Any]:
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError("No JSON object found in response")
    return json.loads(match.group(0))
