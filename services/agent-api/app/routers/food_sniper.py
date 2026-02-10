import logging
import uuid
import json
import os
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, Request
from firebase_admin import firestore as admin_firestore
from firebase_admin.exceptions import FirebaseError
from google.cloud.exceptions import GoogleCloudError
from pydantic import BaseModel, Field, validator

from ..auth import get_current_uid
from ..firebase import get_firestore_client
from ..middleware.rate_limit import limiter
from ..services.gemini_chat import gemini_enabled, generate_text, safe_json_load
from ..config import GEMINI_MODEL

router = APIRouter(prefix="/api/v1/food-sniper", tags=["food-sniper"])


# ---------------------------------------------------------------------------
# Load pattern food map from external JSON file
# ---------------------------------------------------------------------------

def load_pattern_food_map() -> Dict[str, Any]:
    """
    Load pattern food map from external JSON file.
    This separates large data structures from code for better maintainability.

    Returns:
        Dictionary containing pattern-specific food recommendations
    """
    data_file = Path(__file__).parent.parent / "data" / "pattern_food_map.json"

    try:
        with open(data_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logging.error(f"Pattern food map file not found: {data_file}")
        return {}
    except json.JSONDecodeError as e:
        logging.error(f"Failed to parse pattern food map JSON: {e}")
        return {}
    except Exception as e:
        logging.error(f"Unexpected error loading pattern food map: {e}", exc_info=True)
        return {}

# Load pattern food map at module initialization
PATTERN_FOOD_MAP = load_pattern_food_map()


# ---------------------------------------------------------------------------
# Pattern validation
# ---------------------------------------------------------------------------

# Allowed hair loss pattern values (whitelist)
ALLOWED_HAIR_PATTERNS = {
    "M字",
    "O字",
    "U字",
    "びまん性",
    "オルセン型",
    "ハミルトン型",
    "None",  # Pattern not identifiable or not applicable
}


def validate_hair_pattern(pattern: Optional[str]) -> Optional[str]:
    """
    Validate hair loss pattern against whitelist.
    Returns None if pattern is invalid or None.
    Logs warning for invalid patterns.

    Args:
        pattern: Hair loss pattern string to validate

    Returns:
        Validated pattern or None if invalid
    """
    if not pattern:
        return None

    if pattern not in ALLOWED_HAIR_PATTERNS:
        logging.warning(
            f"Invalid hair pattern value detected: '{pattern}'. "
            f"Allowed values: {', '.join(ALLOWED_HAIR_PATTERNS)}"
        )
        return None

    return pattern


# ---------------------------------------------------------------------------
# Pydantic モデル
# ---------------------------------------------------------------------------


class FoodSniperRequest(BaseModel):
    message: Optional[str] = Field(None, max_length=1000, description="User message for food recommendation")
    hairPattern: Optional[str] = Field(None, pattern="^(M字|O字|U字|びまん性|オルセン型|ハミルトン型|None)$", description="Hair loss pattern")

    @validator('message')
    def validate_message(cls, v):
        if v and not v.strip():
            raise ValueError('Message cannot be empty or whitespace only')
        return v.strip() if v else ""


class FoodDetail(BaseModel):
    name: str
    emoji: str
    serving: str
    amount: str
    dailyPercentValue: Optional[int] = None
    dailyPercent: str
    tip: str
    why: str


class NutrientInfo(BaseModel):
    name: str
    role: str
    dailyRecommended: Optional[str] = None
    foods: List[FoodDetail]


class PatternInfo(BaseModel):
    label: str
    description: str
    cause: str
    strategy: str


class FoodSniperResponse(BaseModel):
    patternInfo: Optional[PatternInfo] = None
    nutrients: List[NutrientInfo]
                    },
                ],
            },
            {
                "name": "オメガ3 + ビタミンE",
                "role": "ホルモン合成の材料となり、抗炎症作用で頭皮を保護する",
                "dailyRecommended": "n-3系脂肪酸 2.0g / ビタミンE 5.0mg（女性）",
                "foods": [
                    {
                        "name": "青魚（まさば）",
                        "emoji": "🐟",
                        "serving": "1切れ（80g）",
                        "amount": "EPA+DHA 約1.3g",
                        "dailyPercentValue": 65,
                        "dailyPercent": "約65%",
                        "tip": "サバ缶は保存がきき、調理も不要で続けやすい",
                        "why": "サバのEPA+DHAはホルモン合成の材料となり、抗炎症作用で頭皮を保護します",
                    },
                    {
                        "name": "ナッツ類（アーモンド）",
                        "emoji": "🥜",
                        "serving": "25粒（約25g）",
                        "amount": "ビタミンE 7.4mg、亜鉛 1.0mg",
                        "dailyPercentValue": 148,
                        "dailyPercent": "ビタミンE 約148%（女性基準）",
                        "tip": "素焼きを選び、間食として1日25粒が理想的",
                        "why": "アーモンドはビタミンEとミネラルが豊富で、ホルモンバランスの維持に役立ちます",
                    },
                ],
            },
        ],
    },
}

# パターン未特定時の汎用フォールバック
GENERIC_FALLBACK_NUTRIENTS = [
    {
        "name": "タンパク質",
        "role": "髪の主成分ケラチンの材料",
        "foods": [
            {"name": "卵", "emoji": "🥚", "serving": "2個（100g）", "amount": "タンパク質 12.2g", "dailyPercentValue": 24, "dailyPercent": "約24%", "tip": "完全栄養食。手軽にタンパク質補給", "why": "卵はタンパク質とビオチンを含む完全栄養食で、髪のケラチン生成をサポートします"},
            {"name": "銀鮭", "emoji": "🍣", "serving": "1切れ（80g）", "amount": "タンパク質 17.8g", "dailyPercentValue": 36, "dailyPercent": "約36%", "tip": "オメガ3も同時に摂れる", "why": "鮭はタンパク質とオメガ3を同時に摂取できる優れた食材です"},
        ],
    },
    {
        "name": "亜鉛",
        "role": "ケラチン合成とホルモンバランスの調整",
        "foods": [
            {"name": "牡蠣", "emoji": "🦪", "serving": "2個（40g）", "amount": "亜鉛 5.6mg", "dailyPercentValue": 51, "dailyPercent": "約51%", "tip": "亜鉛含有量トップ", "why": "牡蠣は亜鉛含有量が食品中で最も多く、ケラチン合成に必要不可欠です"},
            {"name": "ナッツ類", "emoji": "🥜", "serving": "25g", "amount": "亜鉛 1.0mg", "dailyPercentValue": 9, "dailyPercent": "約9%", "tip": "間食に最適", "why": "ナッツ類は亜鉛とビタミンEを含み、間食に最適な髪の栄養補給源です"},
        ],
    },
    {
        "name": "鉄分",
        "role": "毛包への酸素供給に不可欠",
        "foods": [
            {"name": "レバー", "emoji": "🥩", "serving": "50g", "amount": "鉄 6.5mg", "dailyPercentValue": 62, "dailyPercent": "約62%", "tip": "吸収率の高いヘム鉄", "why": "レバーはヘム鉄が豊富で吸収率も高く、毛包への酸素供給を効率的に改善します"},
            {"name": "納豆", "emoji": "🫘", "serving": "1パック（50g）", "amount": "鉄 1.7mg", "dailyPercentValue": 16, "dailyPercent": "約16%", "tip": "毎朝の習慣に", "why": "納豆は鉄分に加えイソフラボンも含み、毎日の習慣にしやすい髪の味方です"},
        ],
    },
]


# ---------------------------------------------------------------------------
# Gemini プロンプト（ハイブリッド方式: キュレーション済みリストから選択）
# ---------------------------------------------------------------------------

FOOD_RECOMMEND_PROMPT = """\
あなたは管理栄養士です。薄毛パターンに基づき、以下のキュレーション済み食材リストから
ユーザーに最も優先度の高い食材を5つ選んでください。

ユーザーの薄毛パターン: {pattern}（{cause}）
対策方針: {strategy}
ユーザーの食事から不足している栄養素: {deficiencies}

【キュレーション済み食材リスト】
{food_list}

以下のJSON形式で出力してください（JSON以外は出力しないでください）:
{{
  "items": [
    {{"name": "食材名（リストの名前と完全一致させること）", "nutrient": "対応する栄養素名", "reason": "この食材を選んだ理由（1文）"}}
  ]
}}

条件:
- 上記リストに載っている食材のみ選ぶこと（リスト外の食材は選ばないでください）
- ユーザーの不足栄養素を優先的にカバーする食材を選ぶこと
- 食材名はリストと完全一致させること
"""

FOOD_RECOMMEND_PROMPT_GENERIC = """\
あなたは管理栄養士です。髪の健康を意識した食材を推薦してください。

ユーザーの不足栄養素: {deficiencies}

以下のキュレーション済み食材リストから5つ選んでください。

【キュレーション済み食材リスト】
{food_list}

以下のJSON形式で出力してください（JSON以外は出力しないでください）:
{{
  "items": [
    {{"name": "食材名（リストの名前と完全一致させること）", "nutrient": "対応する栄養素名", "reason": "この食材を選んだ理由（1文）"}}
  ]
}}

条件:
- 上記リストに載っている食材のみ選ぶこと
- 食材名はリストと完全一致させること
"""

RECIPE_PROMPT = """\
以下の食材を使った、髪の健康に良い簡単レシピを2つ提案してください。

食材: {food_name}
{pattern_context}

以下のJSON形式で出力してください（JSON以外は出力しないでください）:
{{
  "recipes": [
    {{
      "name": "レシピ名",
      "description": "簡単な作り方（3ステップ以内）",
      "ingredients": ["材料1", "材料2", "材料3"],
      "benefit": "このレシピが髪の健康に良い理由（1文）"
    }}
  ]
}}

条件:
- 調理時間15分以内の簡単なレシピにすること
- スーパーで手に入る一般的な食材のみ使用すること
"""


# ---------------------------------------------------------------------------
# ヘルパー関数
# ---------------------------------------------------------------------------


def _get_user_hair_pattern(uid: str) -> Optional[str]:
    """Firestore から最新の解析結果の薄毛パターンを取得する。"""
    try:
        db = get_firestore_client()
        results = (
            db.collection("analysisResults")
            .document(uid)
            .collection("items")
            .order_by("createdAt", direction=admin_firestore.Query.DESCENDING)
            .limit(1)
            .get()
        )
        for doc in results:
            data = doc.to_dict()
            pattern = data.get("pattern") or data.get("hairPattern")
            if pattern:
                # Validate pattern against whitelist
                validated_pattern = validate_hair_pattern(pattern)
                if validated_pattern:
                    return validated_pattern
                else:
                    logging.warning(
                        f"Firestore returned invalid hair pattern for uid={uid}: '{pattern}'. Ignoring."
                    )
    except (FirebaseError, GoogleCloudError) as e:
        logging.error(f"Firestore error fetching user hair pattern: {e}")
    except Exception as e:
        logging.error(f"Unexpected error fetching user hair pattern: {e}", exc_info=True)
    return None


def _get_all_foods_for_pattern(pattern: Optional[str]) -> list[dict]:
    """パターンに紐づく全食材をフラットなリストで返す。"""
    if pattern and pattern in PATTERN_FOOD_MAP:
        nutrients = PATTERN_FOOD_MAP[pattern]["nutrients"]
    else:
        nutrients = GENERIC_FALLBACK_NUTRIENTS
    foods = []
    for nutrient in nutrients:
        for food in nutrient["foods"]:
            foods.append({**food, "nutrient": nutrient["name"]})
    return foods


def _build_food_list_text(foods: list[dict]) -> str:
    """Gemini プロンプト用の食材リスト文字列を生成。"""
    lines = []
    for f in foods:
        lines.append(f"- {f['name']}（{f['nutrient']}）: {f['amount']}")
    return "\n".join(lines)


def _build_nutrients_response(
    pattern: Optional[str],
    selected_names: Optional[list[str]] = None,
) -> List[NutrientInfo]:
    """パターンに基づく栄養素・食材情報をレスポンス用に構築。"""
    if pattern and pattern in PATTERN_FOOD_MAP:
        nutrients_data = PATTERN_FOOD_MAP[pattern]["nutrients"]
    else:
        nutrients_data = GENERIC_FALLBACK_NUTRIENTS

    result = []
    for nutrient in nutrients_data:
        foods = []
        for food in nutrient["foods"]:
            if selected_names and food["name"] not in selected_names:
                continue
            foods.append(FoodDetail(
                name=food["name"],
                emoji=food["emoji"],
                serving=food["serving"],
                amount=food["amount"],
                dailyPercentValue=food.get("dailyPercentValue"),
                dailyPercent=food["dailyPercent"],
                tip=food["tip"],
                why=food["why"],
            ))
        if foods:
            result.append(NutrientInfo(
                name=nutrient["name"],
                role=nutrient["role"],
                dailyRecommended=nutrient.get("dailyRecommended"),
                foods=foods,
            ))
    return result


def _extract_food_recommendations(
    message: str, pattern: Optional[str] = None
) -> tuple[List[NutrientInfo], list[str]]:
    """Gemini で食材を優先度順に選定。失敗時はフォールバック。"""
    all_foods = _get_all_foods_for_pattern(pattern)
    all_names = [f["name"] for f in all_foods]

    if gemini_enabled():
        try:
            food_list_text = _build_food_list_text(all_foods)

            if pattern and pattern in PATTERN_FOOD_MAP:
                info = PATTERN_FOOD_MAP[pattern]
                prompt = FOOD_RECOMMEND_PROMPT.format(
                    pattern=pattern,
                    cause=info["cause"],
                    strategy=info["strategy"],
                    deficiencies=message or "特になし",
                    food_list=food_list_text,
                )
            else:
                prompt = FOOD_RECOMMEND_PROMPT_GENERIC.format(
                    deficiencies=message or "一般的な髪の健康",
                    food_list=food_list_text,
                )

            raw_text = generate_text(prompt, model=GEMINI_MODEL)
            data = safe_json_load(raw_text)
            selected = [
                item["name"]
                for item in data.get("items", [])
                if item.get("name") in all_names
            ]
            if selected:
                nutrients = _build_nutrients_response(pattern, selected)
                shopping = selected
                return nutrients, shopping
        except (ValueError, json.JSONDecodeError, RuntimeError) as e:
            logging.warning(f"Gemini food recommendation failed: {e}")
        except Exception as e:
            logging.error(f"Unexpected error in food recommendation: {e}", exc_info=True)

    # フォールバック: 全食材をそのまま返す
    nutrients = _build_nutrients_response(pattern)
    shopping = all_names
    return nutrients, shopping


# ---------------------------------------------------------------------------
# API エンドポイント
# ---------------------------------------------------------------------------


@router.post("/recommend", response_model=FoodSniperResponse)
@limiter.limit("10/minute")
def recommend_food_sniper(
    request: Request, payload: FoodSniperRequest, uid: str = Depends(get_current_uid)
) -> FoodSniperResponse:
    # パターン取得: リクエスト > Firestore の順で探す
    pattern = payload.hairPattern
    if not pattern:
        pattern = _get_user_hair_pattern(uid)

    nutrients, shopping_list = _extract_food_recommendations(
        payload.message, pattern
    )

    # パターン情報を構築
    pattern_info = None
    if pattern and pattern in PATTERN_FOOD_MAP:
        info = PATTERN_FOOD_MAP[pattern]
        pattern_info = PatternInfo(
            label=info["label"],
            description=info["description"],
            cause=info["cause"],
            strategy=info["strategy"],
        )

    # Firestore に記録
    db = get_firestore_client()
    request_id = f"food_{uuid.uuid4().hex}"
    db.collection("foodRequests").document(uid).collection("items").document(
        request_id
    ).set(
        {
            "createdAt": admin_firestore.SERVER_TIMESTAMP,
            "query": payload.message,
            "hairPattern": pattern,
            "nutrients": [n.model_dump() for n in nutrients],
            "shoppingList": shopping_list,
        }
    )

    return FoodSniperResponse(
        patternInfo=pattern_info,
        nutrients=nutrients,
        shoppingList=shopping_list,
        hairPattern=pattern,
    )


@router.post("/recipe", response_model=RecipeResponse)
@limiter.limit("10/minute")
def generate_recipe(
    request: Request, payload: RecipeRequest, uid: str = Depends(get_current_uid)
) -> RecipeResponse:
    """食材名からGeminiでレシピを生成。失敗時はフォールバック。"""
    pattern_context = ""
    if payload.hairPattern and payload.hairPattern in PATTERN_FOOD_MAP:
        info = PATTERN_FOOD_MAP[payload.hairPattern]
        pattern_context = (
            f"薄毛パターン: {payload.hairPattern}（{info['cause']}）\n"
            f"対策方針: {info['strategy']}"
        )

    if gemini_enabled():
        try:
            prompt = RECIPE_PROMPT.format(
                food_name=payload.foodName,
                pattern_context=pattern_context or "パターン情報なし",
            )
            raw_text = generate_text(prompt, model=GEMINI_MODEL)
            data = safe_json_load(raw_text)
            recipes = [
                RecipeItem(
                    name=r["name"],
                    description=r["description"],
                    ingredients=r.get("ingredients", []),
                    benefit=r.get("benefit", ""),
                )
                for r in data.get("recipes", [])
            ]
            if recipes:
                return RecipeResponse(recipes=recipes)
        except (ValueError, json.JSONDecodeError, RuntimeError) as e:
            logging.warning(f"Gemini recipe generation failed: {e}")
        except Exception as e:
            logging.error(f"Unexpected error in recipe generation: {e}", exc_info=True)

    # フォールバック
    return RecipeResponse(recipes=[
        RecipeItem(
            name=f"{payload.foodName}のシンプル料理",
            description=f"{payload.foodName}を使った簡単な一品です。お好みの味付けでお召し上がりください。",
            ingredients=[payload.foodName, "お好みの調味料"],
            benefit=f"{payload.foodName}の栄養素を手軽に摂取できます",
        ),
    ])
