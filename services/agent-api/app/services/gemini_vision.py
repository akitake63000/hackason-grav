import os
import json
import logging
from dataclasses import dataclass
from typing import Optional, Literal

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

PatternType = Literal['M字', 'O字', 'U字', 'びまん性', 'オルセン型', 'ハミルトン型', 'None']

@dataclass
class VisionResult:
    score: float
    notes: Optional[str] = None
    hairType: Optional[str] = None
    pattern: Optional[PatternType] = None
    scalpCondition: Optional[str] = None
    quality: Optional[str] = None

def vision_enabled() -> bool:
    if GOOGLE_GENAI_USE_VERTEXAI:
        return bool(GOOGLE_CLOUD_PROJECT)
    else:
        return bool(os.environ.get("GOOGLE_API_KEY"))

def analyze_image_bytes(image_bytes: bytes, gender: Optional[str] = "prefer-not-to-say") -> VisionResult:
    """
    Analyzes the image bytes using Gemini Vision via Vertex AI.
    Returns a score (0-100) and notes, plus detailed analysis fields (hair type, pattern, scalp condition, quality).
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

        prompt_base = """
        You are an expert trichologist (hair and scalp specialist).
        Analyze this image of a scalp/hair.

        Provide the following in JSON format:
        - "score": A float between 0.0 and 100.0 representing hair density and health (100 is best).
        """

        prompt_gender_specific = ""
        if gender == "male":
            prompt_gender_specific = """
        - "hairType": Classify using Hamilton-Norwood scale (e.g., "Hamilton-Norwood III-Vertex").
        - "pattern": Hair loss pattern. MUST be one of the following exact Japanese strings:
            - "M字": Receding hairline at the temples (M-shaped).
            - "O字": Thinning at the vertex/crown (O-shaped).
            - "U字": Receding hairline and vertex thinning merging (U-shaped).
            - "None": If no significant hair loss is observed.
            """
        elif gender == "female":
            prompt_gender_specific = """
        - "hairType": Classify using Ludwig scale (e.g., "Ludwig II").
        - "pattern": Hair loss pattern. MUST be one of the following exact Japanese strings:
            - "びまん性": Diffuse thinning over the entire scalp.
            - "オルセン型": christmas tree pattern, widening of the part line.
            - "ハミルトン型": Male-pattern thinning but occurring in females.
            - "None": If no significant hair loss is observed.
            """
        else:  # prefer-not-to-say or unknown
            prompt_gender_specific = """
        - "hairType": Analyze the visual features and classify using the most medically appropriate scale (Hamilton-Norwood or Ludwig) based on the observed pattern.
          Examples: "Hamilton-Norwood II", "Ludwig I-2".
        - "pattern": Hair loss pattern. MUST be one of the following exact Japanese strings based on the identified visual pattern:
            - "M字": Receding hairline at the temples (M-shaped).
            - "O字": Thinning at the vertex/crown (O-shaped).
            - "U字": Receding hairline and vertex thinning merging (U-shaped).
            - "びまん性": Diffuse thinning over the entire scalp (common in females).
            - "オルセン型": christmas tree pattern, widening of the part line (common in females).
            - "ハミルトン型": Male-pattern thinning but occurring in females.
            - "None": If no significant hair loss is observed.
            """

        prompt_common = """
        - "quality": Image quality for analysis ("good", "fair", "poor").
        - "scalpCondition": 文字列。以下のいずれかを選択してください: "良好", "乾燥", "脂性", "炎症", "フケが多い"。
        - "notes": A brief, professional summary of the condition in Japanese (approx 50 chars).

        Ensure the output is raw JSON without markdown formatting.
        """

        prompt = prompt_base + prompt_gender_specific + prompt_common

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
            hair_type = data.get("hairType")
            pattern = data.get("pattern")
            
            # Pattern validation (runtime check)
            valid_patterns = ['M字', 'O字', 'U字', 'びまん性', 'オルセン型', 'ハミルトン型', 'None']
            if pattern and pattern not in valid_patterns:
                logger.warning(f"Invalid pattern received from Gemini: {pattern}. Normalizing to None.")
                pattern = None # Or handle as None
            
            quality = data.get("quality")
            scalp_condition = data.get("scalpCondition")

            logger.info(f"Extracted score: {score}, notes: {notes}")

            return VisionResult(
                score=score,
                notes=notes,
                hairType=hair_type,
                pattern=pattern, # type: ignore
                scalpCondition=scalp_condition,
                quality=quality
            )
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from Gemini: {response.text}, error: {e}")
            return VisionResult(score=0.0, notes=f"Failed to parse analysis result: {response.text[:100]}")

    except Exception as e:
        logger.exception(f"Gemini Vision API Error: {e}")
        return VisionResult(score=0.0, notes=f"Analysis error: {str(e)}")


def analyze_scan_images(
    side_bytes: bytes,
    front_bytes: bytes,
    top_bytes: bytes,
    gender: Optional[str] = "prefer-not-to-say",
    device_type: Optional[str] = "pc"
) -> VisionResult:
    """
    Analyzes 3 images (Side, Front, Top) to provide an integrated diagnosis.
    - Side: Baseline (healthiest part).
    - Top: Focus area for thinning.
    - Front: Receding hairline check.
    """
    if not vision_enabled():
         return VisionResult(score=0.0, notes="Vision API not enabled")

    try:
        # Initialize client
        if GOOGLE_GENAI_USE_VERTEXAI:
            client = genai.Client(
                vertexai=True,
                project=GOOGLE_CLOUD_PROJECT,
                location=GOOGLE_CLOUD_LOCATION,
                http_options=HttpOptions(api_version="v1")
            )
        else:
            client = genai.Client(http_options=HttpOptions(api_version="v1"))

        prompt = f"""
        You are an expert trichologist. Analyze these 3 images of a user's head:
        1. Side (Ear area) - Use this as the "Healthy Baseline" for density.
        2. Front (Hairline) - Check for recession.
        3. Top (Vertex) - Check for thinning relative to Side.

        **Context**:
        - Device: {device_type.upper()} camera. Image quality may vary.
        - **IMPORTANT INCLUSIVITY NOTE**: The user may have White, Gray, or Blonde hair. Do NOT interpret light hair color itself as thinning. Focus on the VISIBLE SCALP DENSITY contrast between the Side (baseline) and Top.

        **Task**:
        1. Compare the hair density of the TOP against the SIDE.
        2. If Top density << Side density, indicate thinning.
        3. If Top density ~= Side density, it is healthy.

        **Output format (JSON)**:
        - "score": Float (0-100). 100 = No thinning (Top matches Side). Lower score = Significant difference.
        - "hairType": Hamilton-Norwood (Male) or Ludwig (Female).
        - "pattern": One of ["M字", "O字", "U字", "びまん性", "オルセン型", "ハミルトン型", "None"].
        - "scalpCondition": One of ["良好", "乾燥", "脂性", "炎症", "フケが多い"].
        - "quality": "good", "fair", or "poor".
        - "notes": Professional summary in Japanese (approx 50 chars), specifically mentioning the comparison result (e.g., "側頭部と比較して頭頂部の密度が...").
        """

        response = client.models.generate_content(
            model=GEMINI_MODEL_VISION,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(text=prompt),
                        types.Part.from_bytes(data=side_bytes, mime_type="image/jpeg"),
                        types.Part.from_bytes(data=front_bytes, mime_type="image/jpeg"),
                        types.Part.from_bytes(data=top_bytes, mime_type="image/jpeg"),
                    ]
                )
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )

        logger.info(f"Gemini Scan Response: {response.text}")
        data = json.loads(response.text)

        score = float(data.get("score", 0.0))
        return VisionResult(
            score=score,
            notes=data.get("notes"),
            hairType=data.get("hairType"),
            pattern=data.get("pattern"),
            scalpCondition=data.get("scalpCondition"),
            quality=data.get("quality")
        )

    except Exception as e:
        logger.exception(f"Gemini Scan Analysis Error: {e}")
        return VisionResult(score=0.0, notes=f"Scan analysis error: {str(e)}")
