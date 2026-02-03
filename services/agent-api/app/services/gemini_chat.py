import json
import re

from ..llm.vertex_gemini import GEMINI_MODEL, gemini_enabled as _gemini_enabled
from ..llm.vertex_gemini import generate_text as _generate_text


def gemini_enabled(model: str | None = None) -> bool:
    target_model = model or GEMINI_MODEL
    return _gemini_enabled() and bool(target_model)


def generate_text(prompt: str, model: str | None = None) -> str:
    return _generate_text(prompt, model=model)


def safe_json_load(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            raise
        return json.loads(match.group(0))


__all__ = ["GEMINI_MODEL", "gemini_enabled", "generate_text", "safe_json_load"]
