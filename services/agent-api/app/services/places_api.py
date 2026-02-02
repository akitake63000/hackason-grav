from dataclasses import dataclass
from typing import List


@dataclass
class PlaceCandidate:
    name: str
    distance_m: int | None
    confidence: float
    note: str


def search_nearby(lat: float, lng: float, radius_m: int) -> List[PlaceCandidate]:
    return []
