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
        You are an expert trichologist (hair and scalp specialist).
        Analyze this image of a scalp/hair.
        
        Provide the following in JSON format:
        - "score": A float between 0.0 and 100.0 representing hair density and health (100 is best).
        - "notes": A brief, professional summary of the condition (e.g., "Good density, slight redness visible", "Thinning observed in crown area").
        
        Ensure the output is raw JSON without markdown formatting.
        """

        response = client.models.generate_content(
            model=GEMINI_MODEL_VISION, 
            contents=[
                types.Content(
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
            data = json.loads(response.text)
            return VisionResult(
                score=float(data.get("score", 0.0)),
                notes=data.get("notes", "")
            )
        except json.JSONDecodeError:
            logger.error(f"Failed to parse JSON from Gemini: {response.text}")
            return VisionResult(score=0.0, notes="Failed to parse analysis result")

    except Exception as e:
        logger.exception(f"Gemini Vision API Error: {e}")
        return VisionResult(score=0.0, notes=f"Analysis error: {str(e)}")
