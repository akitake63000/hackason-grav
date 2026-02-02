import math
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends
from firebase_admin import firestore as admin_firestore
from pydantic import BaseModel

from ..auth import get_current_uid
from ..firebase import get_firestore_client

router = APIRouter(prefix="/api/v1/food-sniper", tags=["food-sniper"])


class Location(BaseModel):
    lat: float
    lng: float
    accuracyM: Optional[float] = None


class FoodSniperRequest(BaseModel):
    message: str
    location: Optional[Location] = None
    radiusM: Optional[int] = 800


class FoodItem(BaseModel):
    name: str
    why: str


class StoreCandidate(BaseModel):
    name: str
    distanceM: Optional[int]
    confidence: float
    note: str


class FoodSniperResponse(BaseModel):
    items: List[FoodItem]
    stores: List[StoreCandidate]
    shoppingList: List[str]


def _haversine_distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    radius = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)

    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return int(radius * c)


def _extract_food_items(message: str) -> List[FoodItem]:
    catalog = [
        ("レバー", "鉄・ビタミンB群など（一般論）"),
        ("卵", "タンパク質とビオチンの補給（一般論）"),
        ("ナッツ", "ビタミンE・亜鉛（一般論）"),
        ("鮭", "タンパク質とオメガ3（一般論）"),
        ("納豆", "タンパク質・ミネラル（一般論）"),
        ("牡蠣", "亜鉛を意識しやすい（一般論）"),
        ("鶏むね", "高タンパクで続けやすい（一般論）"),
    ]

    items: List[FoodItem] = []
    for name, why in catalog:
        if name in message:
            items.append(FoodItem(name=name, why=why))

    if not items:
        items = [
            FoodItem(name="卵", why="タンパク質とビオチンの補給（一般論）"),
            FoodItem(name="ナッツ", why="ビタミンE・亜鉛（一般論）"),
        ]

    return items


def _build_store_candidates(
    location: Optional[Location], radius_m: int, items: List[FoodItem]
) -> List[StoreCandidate]:
    if location is None:
        return []

    dummy_stores = [
        {
            "name": "スーパーA",
            "lat": location.lat + 0.0012,
            "lng": location.lng + 0.0007,
            "type": "supermarket",
        },
        {
            "name": "コンビニB",
            "lat": location.lat - 0.0009,
            "lng": location.lng + 0.0004,
            "type": "convenience",
        },
        {
            "name": "ドラッグストアC",
            "lat": location.lat + 0.0018,
            "lng": location.lng - 0.0006,
            "type": "drugstore",
        },
    ]

    candidates: List[StoreCandidate] = []
    for store in dummy_stores:
        distance = _haversine_distance_m(
            location.lat, location.lng, store["lat"], store["lng"]
        )
        if distance > radius_m:
            continue

        base_confidence = {
            "supermarket": 0.75,
            "convenience": 0.55,
            "drugstore": 0.45,
        }.get(store["type"], 0.4)

        confidence = min(0.9, base_confidence + 0.05 * len(items))
        note = (
            "惣菜/精肉があれば入手しやすい"
            if store["type"] == "supermarket"
            else "代替案があると安心"
        )

        candidates.append(
            StoreCandidate(
                name=store["name"],
                distanceM=distance,
                confidence=confidence,
                note=note,
            )
        )

    candidates.sort(key=lambda c: (c.distanceM or 0))
    return candidates


@router.post("/recommend", response_model=FoodSniperResponse)
def recommend_food_sniper(
    payload: FoodSniperRequest, uid: str = Depends(get_current_uid)
) -> FoodSniperResponse:
    items = _extract_food_items(payload.message)
    radius = payload.radiusM or 800
    stores = _build_store_candidates(payload.location, radius, items)

    shopping_list = [f"{item.name}" for item in items]
    if "卵" not in shopping_list:
        shopping_list.append("卵（代替）")

    db = get_firestore_client()
    request_id = f"food_{uuid.uuid4().hex}"
    db.collection("foodRequests").document(uid).collection("items").document(
        request_id
    ).set(
        {
            "createdAt": admin_firestore.SERVER_TIMESTAMP,
            "query": payload.message,
            "location": payload.location.model_dump() if payload.location else None,
            "recommendations": [item.dict() for item in items],
            "stores": [store.dict() for store in stores],
            "shoppingList": shopping_list,
        }
    )

    return FoodSniperResponse(items=items, stores=stores, shoppingList=shopping_list)
