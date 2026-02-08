import os
import json
import logging
from dataclasses import dataclass
from typing import Optional

from google import genai
from google.genai import types

# Configure Logger
logger = logging.getLogger(__name__)

@dataclass
class VisionResult:
    score: float
    notes: Optional[str] = None
    hairType: Optional[str] = None
    pattern: Optional[str] = None
    quality: Optional[str] = None

def vision_enabled() -> bool:
    return bool(os.environ.get("GOOGLE_API_KEY"))

def analyze_image_bytes(image_bytes: bytes) -> VisionResult:
    """
    Analyzes the image bytes using Gemini Vision (Flash model).
    Returns a score (0-100), hair type, pattern, quality and notes.
    """
    if not vision_enabled():
        logger.warning("GOOGLE_API_KEY not set. Returning dummy result.")
        return VisionResult(score=0.0, notes="Vision API not enabled")

    try:
        api_key = os.environ["GOOGLE_API_KEY"]
        client = genai.Client(api_key=api_key)

        prompt = """
        You are an expert trichologist (hair and scalp specialist).
        Analyze this image of a scalp/hair.
        
        Provide the following in JSON format:
        - "score": A float between 0.0 and 100.0 representing hair density and health (100 is best).
        - "hairType": Norwood-Hamilton scale classification (e.g., "Type II", "Type III-Vertex") or "Normal".
        - "pattern": Hair loss pattern (e.g., "M-Shape", "O-Shape", "U-Shape", "Diffuse", "None").
        - "quality": Image quality for analysis ("good", "fair", "poor").
        - "notes": A brief, professional summary of the condition in Japanese (approx 50 chars).
        
        Ensure the output is raw JSON without markdown formatting.
        """

        response = client.models.generate_content(
            model="gemini-1.5-flash", 
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
                notes=data.get("notes", ""),
                hairType=data.get("hairType"),
                pattern=data.get("pattern"),
                quality=data.get("quality")
            )
        except json.JSONDecodeError:
            logger.error(f"Failed to parse JSON from Gemini: {response.text}")
            return VisionResult(score=0.0, notes="Failed to parse analysis result")

    except Exception as e:
        logger.exception(f"Gemini Vision API Error: {e}")
        return VisionResult(score=0.0, notes=f"Analysis error: {str(e)}")
