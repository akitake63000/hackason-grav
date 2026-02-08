import logging
import os
from dataclasses import dataclass
from typing import List, Optional

import requests

GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")

PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby"


@dataclass
class PlaceCandidate:
    name: str
    distance_m: Optional[int]
    confidence: float
    note: str
    lat: Optional[float] = None
    lng: Optional[float] = None


def search_nearby(lat: float, lng: float, radius_m: int) -> List[PlaceCandidate]:
    """Google Places API (New) で近くのスーパー・食料品店を検索する。
    APIキー未設定 or エラー時は空リストを返す。
    """
    if not GOOGLE_PLACES_API_KEY:
        return []

    try:
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask": "places.displayName,places.location,places.formattedAddress,places.types",
        }
        body = {
            "includedTypes": ["supermarket", "grocery_store"],
            "maxResultCount": 5,
            "locationRestriction": {
                "circle": {
                    "center": {"latitude": lat, "longitude": lng},
                    "radius": float(radius_m),
                }
            },
        }

        resp = requests.post(PLACES_NEARBY_URL, json=body, headers=headers, timeout=5)
        resp.raise_for_status()
        data = resp.json()

        candidates: List[PlaceCandidate] = []
        for place in data.get("places", []):
            display_name = place.get("displayName", {}).get("text", "不明な店舗")
            loc = place.get("location", {})
            place_lat = loc.get("latitude")
            place_lng = loc.get("longitude")

            # 距離の概算
            dist = None
            if place_lat and place_lng:
                import math

                d_lat = math.radians(place_lat - lat)
                d_lng = math.radians(place_lng - lng)
                a = (
                    math.sin(d_lat / 2) ** 2
                    + math.cos(math.radians(lat))
                    * math.cos(math.radians(place_lat))
                    * math.sin(d_lng / 2) ** 2
                )
                dist = int(6371000 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))

            place_types = place.get("types", [])
            note = (
                "スーパーマーケット"
                if "supermarket" in place_types
                else "食料品店"
            )

            candidates.append(
                PlaceCandidate(
                    name=display_name,
                    distance_m=dist,
                    confidence=0.85,
                    note=note,
                    lat=place_lat,
                    lng=place_lng,
                )
            )

        candidates.sort(key=lambda c: (c.distance_m or 9999))
        return candidates

    except Exception:
        logging.exception("Places API search failed")
        return []
