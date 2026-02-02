from dataclasses import dataclass


@dataclass
class VisionResult:
    score: float
    notes: str | None = None


def vision_enabled() -> bool:
    return False


def analyze_image_bytes(image_bytes: bytes) -> VisionResult:
    return VisionResult(score=0.0, notes="not_implemented")
