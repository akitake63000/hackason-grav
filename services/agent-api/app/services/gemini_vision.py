import os
import json
import logging
from dataclasses import dataclass
from typing import Optional

from google import genai
from google.genai import types
from google.genai.types import HttpOptions

from ..config import (
    GOOGLE_CLOUD_PROJECT,
    GOOGLE_CLOUD_LOCATION,
    GEMINI_MODEL_VISION,
    GOOGLE_GENAI_USE_VERTEXAI
)

# Configure Logger
logger = logging.getLogger(__name__)

@dataclass
class VisionResult:
    score: float
    notes: Optional[str] = None

def vision_enabled() -> bool:
    if GOOGLE_GENAI_USE_VERTEXAI:
        return bool(GOOGLE_CLOUD_PROJECT)
    else:
        return bool(os.environ.get("GOOGLE_API_KEY"))

def analyze_image_bytes(image_bytes: bytes) -> VisionResult:
    """
    Analyzes the image bytes using Gemini Vision via Vertex AI.
    Returns a score (0-100) and notes.
    """
    if not vision_enabled():
        if GOOGLE_GENAI_USE_VERTEXAI:
            logger.warning("GOOGLE_CLOUD_PROJECT not set. Returning dummy result.")
        else:
            logger.warning("GOOGLE_API_KEY not set. Returning dummy result.")
        return VisionResult(score=0.0, notes="Vision API not enabled")

    try:
        # Initialize client (Vertex AI or Google AI Studio based on config)
        if GOOGLE_GENAI_USE_VERTEXAI:
            client = genai.Client(
                vertexai=True,
                project=GOOGLE_CLOUD_PROJECT,
                location=GOOGLE_CLOUD_LOCATION,
                http_options=HttpOptions(api_version="v1")
            )
        else:
            # Use Google AI Studio API (requires GOOGLE_API_KEY env var)
            client = genai.Client(http_options=HttpOptions(api_version="v1"))

        prompt = """
        あなたは専門的な毛髪診断士です。
        この頭皮・髪の画像を分析してください。

        以下をJSON形式で提供してください：
        - "score": 0.0から100.0の間の浮動小数点数で、髪の密度と健康状態を表します（100が最良）。
        - "notes": 状態の簡潔で専門的な要約を日本語で記述してください（例: "密度は良好、軽度の赤みが見られます"、"頭頂部に薄毛が観察されます"）。

        出力はマークダウン形式を使わず、生のJSONとしてください。
        notesフィールドは必ず日本語で記述してください。
        """

        response = client.models.generate_content(
            model=GEMINI_MODEL_VISION,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(text=prompt),
                        types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
                    ]
                )
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )

        try:
            # response.text should be JSON due to response_mime_type
            logger.info(f"Gemini response text: {response.text}")
            data = json.loads(response.text)
            logger.info(f"Parsed JSON data: {data}")

            # Extract score with validation
            score_value = data.get("score")
            if score_value is None:
                logger.error(f"'score' field missing in response: {data}")
                return VisionResult(score=0.0, notes="Score field missing in analysis response")

            try:
                score = float(score_value)
            except (ValueError, TypeError) as e:
                logger.error(f"Invalid score value: {score_value}, error: {e}")
                return VisionResult(score=0.0, notes=f"Invalid score value: {score_value}")

            notes = data.get("notes", "")

            logger.info(f"Extracted score: {score}, notes: {notes}")

            return VisionResult(
                score=score,
                notes=notes
            )
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from Gemini: {response.text}, error: {e}")
            return VisionResult(score=0.0, notes=f"Failed to parse analysis result: {response.text[:100]}")

    except Exception as e:
        logger.exception(f"Gemini Vision API Error: {e}")
        return VisionResult(score=0.0, notes=f"Analysis error: {str(e)}")
