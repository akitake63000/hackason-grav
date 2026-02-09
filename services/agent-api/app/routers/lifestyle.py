from datetime import datetime
from zoneinfo import ZoneInfo
import logging
import random
import re
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, validator
from google.cloud import storage as gcs

from ..auth import get_current_uid
from ..config import FIREBASE_STORAGE_BUCKET, GEMINI_MODEL, GEMINI_MODEL_LIGHT
from ..firebase import get_firestore_client
from ..llm.vertex_gemini import _get_client as get_gemini_client, gemini_enabled as _raw_gemini_enabled
from ..services.gemini_chat import gemini_enabled, generate_text, safe_json_load
from ..agents.lifestyle_agent.tools.analyze_tendency import (
    analyze_tendency_scores,
    TendencyScores,
)
from ..agents.lifestyle_agent.tools.recommend_actions import (
    get_recommended_actions,
    RecommendedAction,
    AXIS_LABELS,
)

router = APIRouter(prefix="/api/v1/lifestyle", tags=["lifestyle"])


class TipResponse(BaseModel):
    tip: str
    source: str


class TendencyRequest(BaseModel):
    """問診回答リクエスト"""
    answers: dict[str, str] = Field(..., description="Questionnaire answers (max 50 keys, max 500 chars per value)")

    @validator('answers')
    def validate_answers(cls, v):
        if not v:
            raise ValueError('Answers cannot be empty')
        if len(v) > 50:
            raise ValueError('Too many answer keys (max 50)')
        for key, value in v.items():
            if not isinstance(value, str):
                raise ValueError(f'Answer value for key {key} must be a string')
            if len(value) > 500:
                raise ValueError(f'Answer value for key {key} is too long (max 500 chars)')
        return v


class TendencyResponse(BaseModel):
    """傾向分析レスポンス"""
    scores: dict[str, int]
    dominant_issues: list[str]
    axis_labels: dict[str, dict[str, str]]


class RecommendationResponse(BaseModel):
    """推奨アクションレスポンス"""
    actions: list[dict]
    axis_labels: dict[str, dict[str, str]]


def _season_label(month: int) -> str:
    if month in (3, 4, 5):
        return "春"
    if month in (6, 7, 8):
        return "夏"
    if month in (9, 10, 11):
        return "秋"
    return "冬"


def _time_label(hour: int) -> str:
    if hour < 5:
        return "深夜"
    if hour < 11:
        return "朝"
    if hour < 17:
        return "昼"
    if hour < 21:
        return "夕方"
    return "夜"


FALLBACK_TIPS = {
    "春": [
        "花粉や乾燥で頭皮がゆらぎやすい季節です。洗浄は優しく、保湿を意識しましょう。",
        "春は生活リズムが崩れやすい時期です。就寝時間を一定に保つだけでも頭皮に良い影響があります。",
    ],
    "夏": [
        "汗をかきやすい季節は頭皮の清潔感が大切です。帰宅後は早めの洗髪を心がけましょう。",
        "強い紫外線は頭皮の負担になります。外出時は帽子や日傘で保護すると安心です。",
    ],
    "秋": [
        "秋は抜け毛が増えやすい時期です。地肌をこすり過ぎず、指の腹で洗いましょう。",
        "乾燥が始まるので、シャンプー後の保湿ケアをプラスすると効果的です。",
    ],
    "冬": [
        "乾燥が強い季節は頭皮も潤い不足になりがちです。ぬるめの湯温で洗うのがポイントです。",
        "冷えは血行に影響します。首元を温めるだけでも頭皮への循環が良くなります。",
    ],
}

GENERAL_TIPS = [
    "シャンプー後のドライは根元から。地肌を先に乾かすとふんわり感が出やすいです。",
    "栄養バランスは髪にも大切です。たんぱく質と亜鉛を意識して摂りましょう。",
    "軽いストレッチで首肩のこりをほぐすと、頭皮の血行にも良い影響があります。",
]


def _fallback_tip(season: str) -> str:
    tips = FALLBACK_TIPS.get(season, []) + GENERAL_TIPS
    return random.choice(tips)

def _sanitize_tip(text: str) -> str:
    cleaned = re.sub(r"[（(]?乱数[:：]\\s*\\d+[)）]?", "", text)
    cleaned = re.sub(r"\\s{2,}", " ", cleaned)
    return cleaned.strip()


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/tip", response_model=TipResponse)
def tip(_: str = Depends(get_current_uid)) -> TipResponse:
    now = datetime.now(ZoneInfo("Asia/Tokyo"))
    season = _season_label(now.month)
    time_label = _time_label(now.hour)
    seed = random.randint(1, 1_000_000)

    model = GEMINI_MODEL_LIGHT or GEMINI_MODEL

    if not gemini_enabled(model):
        return TipResponse(tip=_fallback_tip(season), source="fallback")

    prompt = (
        "あなたは薄毛対策の専門家です。"
        "日本語で短い1文のヒントを作成してください。"
        "丁寧で前向きな口調にしてください。"
        f"現在は日本時間の{season}の{time_label}です。"
        "季節と時間帯に合う内容にしてください。"
        "医療的な断定や過度な効果保証は避けてください。"
        f"必ず表現を変えるための乱数: {seed}（出力には含めないでください）。"
        "出力は1文のみ。"
    )

    try:
        text = generate_text(prompt, model=model).strip()
        tip_text = _sanitize_tip(text.splitlines()[0].strip("「」\"' "))
        if not tip_text:
            raise ValueError("empty tip")
        return TipResponse(tip=tip_text, source="gemini")
    except Exception:
        return TipResponse(tip=_fallback_tip(season), source="fallback")


# ---------------------------------------------------------------------------
# POST /meal-analyze — 食事画像の栄養分析
# ---------------------------------------------------------------------------

class MealAnalyzeRequest(BaseModel):
    storagePath: str = Field(..., min_length=1, max_length=500, description="Firebase Storage path (users/{uid}/meals/xxx.jpg)")

    @validator('storagePath')
    def validate_storage_path(cls, v):
        if not v.strip():
            raise ValueError('Storage path cannot be empty or whitespace only')
        # Basic format check (detailed validation happens in storage.validate_storage_path)
        if '..' in v or v.startswith('/'):
            raise ValueError('Invalid storage path format')
        return v.strip()


class NutrientInfo(BaseModel):
    name: str
    current: float
    target: float
    unit: str
    status: str  # "good" | "low"


class MealAnalyzeResponse(BaseModel):
    nutrients: list[NutrientInfo]
    summary: str
    deficiencies: list[str]
    source: str  # "gemini" | "fallback"


FALLBACK_NUTRIENTS = [
    NutrientInfo(name="タンパク質", current=12.0, target=20.0, unit="g", status="low"),
    NutrientInfo(name="鉄分", current=2.5, target=6.0, unit="mg", status="low"),
    NutrientInfo(name="亜鉛", current=3.0, target=8.0, unit="mg", status="low"),
    NutrientInfo(name="ビタミンB群", current=0.8, target=1.2, unit="mg", status="low"),
    NutrientInfo(name="ビタミンC", current=60.0, target=100.0, unit="mg", status="good"),
]

MEAL_ANALYZE_PROMPT = """\
あなたは管理栄養士です。以下の食事画像を分析し、髪の健康に関連する栄養素を推定してください。

以下のJSON形式で回答してください（JSON以外は出力しないでください）:
{
  "nutrients": [
    {"name": "栄養素名", "current": 推定摂取量(数値), "target": 推奨量(数値), "unit": "単位", "status": "good または low"}
  ],
  "summary": "この食事の栄養バランスの1文要約",
  "deficiencies": ["不足している栄養素名のリスト"]
}

必ず以下の栄養素を含めてください: タンパク質, 鉄分, 亜鉛, ビタミンB群, ビタミンC
statusは推定摂取量が推奨量の70%未満なら"low"、それ以上なら"good"にしてください。
"""


def _download_image_from_storage(storage_path: str) -> bytes:
    """Firebase Storage から画像バイトをダウンロードする。"""
    client = gcs.Client()
    bucket = client.bucket(FIREBASE_STORAGE_BUCKET)
    blob = bucket.blob(storage_path)
    return blob.download_as_bytes()


def _analyze_with_gemini(image_bytes: bytes) -> MealAnalyzeResponse:
    """Gemini Vision で食事画像を分析する。"""
    from google.genai.types import Part

    client = get_gemini_client()
    model = GEMINI_MODEL

    image_part = Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
    response = client.models.generate_content(
        model=model,
        contents=[MEAL_ANALYZE_PROMPT, image_part],
    )

    raw_text = response.text or ""
    data = safe_json_load(raw_text)

    nutrients = [
        NutrientInfo(
            name=n["name"],
            current=float(n["current"]),
            target=float(n["target"]),
            unit=n["unit"],
            status=n.get("status", "low"),
        )
        for n in data.get("nutrients", [])
    ]
    summary = data.get("summary", "分析結果を取得しました。")
    deficiencies = data.get("deficiencies", [])

    return MealAnalyzeResponse(
        nutrients=nutrients,
        summary=summary,
        deficiencies=deficiencies,
        source="gemini",
    )


def _fallback_meal_analysis() -> MealAnalyzeResponse:
    """Gemini が使えない場合のフォールバック。"""
    return MealAnalyzeResponse(
        nutrients=FALLBACK_NUTRIENTS,
        summary="画像分析が利用できないため、一般的な食事の栄養推定を表示しています。",
        deficiencies=["タンパク質", "鉄分", "亜鉛", "ビタミンB群"],
        source="fallback",
    )


@router.post("/meal-analyze", response_model=MealAnalyzeResponse)
def meal_analyze(
    req: MealAnalyzeRequest,
    uid: str = Depends(get_current_uid),
) -> MealAnalyzeResponse:
    # Gemini が無効な場合はフォールバック
    if not _raw_gemini_enabled():
        return _fallback_meal_analysis()

    try:
        image_bytes = _download_image_from_storage(req.storagePath)
    except Exception:
        logging.exception("Failed to download image from Storage: %s", req.storagePath)
        return _fallback_meal_analysis()

    try:
        result = _analyze_with_gemini(image_bytes)
    except Exception:
        logging.exception("Gemini meal analysis failed")
        return _fallback_meal_analysis()

    # Firestore に結果を保存
    try:
        db = get_firestore_client()
        doc_id = str(uuid.uuid4())
        db.collection("users").document(uid).collection("mealAnalysis").document(doc_id).set(
            {
                "storagePath": req.storagePath,
                "nutrients": [n.model_dump() for n in result.nutrients],
                "summary": result.summary,
                "deficiencies": result.deficiencies,
                "createdAt": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(),
            }
        )
    except Exception:
        logging.exception("Failed to save meal analysis to Firestore")
        # 保存失敗でもレスポンスは返す

    return result

# ============================================================
# 傾向分析 API
# ============================================================


@router.post("/tendency", response_model=TendencyResponse)
def tendency(
    request: TendencyRequest,
    uid: str = Depends(get_current_uid),
) -> TendencyResponse:
    """
    問診回答から4軸（ホルモン/体内時計/血流/ストレス）のスコアを算出する。
    また、機能1（解析結果）を取得してスコアに反映し、結果をFirestoreに保存する。
    """
    db = get_firestore_client()

    # 1. 機能1 (haircheck) の最新結果を取得してスコア調整用の入力を準備
    # (例: 生え際スコアが低い場合、血流やホルモンの重みを増やす等のロジックを将来的に拡張可能)
    hair_analysis = None
    try:
        # 最新の解析結果を1件取得
        results_ref = db.collection("users").document(uid).collection("analysisResults")
        latest_results = (
            results_ref.order_by("analyzedAt", direction="DESCENDING").limit(1).get()
        )
        if latest_results:
            hair_analysis = latest_results[0].to_dict()
    except Exception as e:
        print(f"Error fetching hair analysis: {e}")

    # 2. スコア算出
    result = analyze_tendency_scores(request.answers, hair_analysis=hair_analysis)
    scores = result["scores"]

    # 3. Firestore に保存
    try:
        # 4軸名をFirestore設計に合わせてマッピング
        # hormone -> hormonal, blood_flow -> bloodCirculation
        # circadian, stress はそのまま、または追加
        db.collection("users").document(uid).collection("tendencyScores").document(
            "latest"
        ).set(
            {
                "hormonal": scores["hormone"],
                "bloodCirculation": scores["blood_flow"],
                "circadian": scores["circadian"],
                "stress": scores["stress"],
                "updatedAt": datetime.now(ZoneInfo("Asia/Tokyo")),
                "hairlineScoreSource": hair_analysis.get("hairlineScore")
                if hair_analysis
                else None,
            }
        )
    except Exception as e:
        print(f"Error saving scores to Firestore: {e}")

    return TendencyResponse(
        scores=scores,
        dominant_issues=result["dominant_issues"],
        axis_labels=AXIS_LABELS,
    )


class TendencyHistoryResponse(TendencyResponse):
    updatedAt: datetime | None = None


@router.get("/tendency/latest", response_model=TendencyHistoryResponse)
def get_latest_tendency(
    uid: str = Depends(get_current_uid),
) -> TendencyHistoryResponse:
    """
    最新の診断結果を取得する。
    存在しない場合は 404 を返す。
    """
    from fastapi import HTTPException

    db = get_firestore_client()
    doc_ref = db.collection("users").document(uid).collection("tendencyScores").document("latest")
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="No tendency data found")

    data = doc.to_dict()
    
    # Map Firestore keys back to API keys
    # Firestore: hormonal, bloodCirculation, circadian, stress
    # API: hormone, blood_flow, circadian, stress
    scores = {
        "hormone": data.get("hormonal", 0),
        "blood_flow": data.get("bloodCirculation", 0),
        "circadian": data.get("circadian", 0),
        "stress": data.get("stress", 0),
    }

    # Re-calculate dominant issues (lowest 2 < 50)
    # Ideally checking against < 50, similar to analyze_tendency logic
    sorted_axes = sorted(scores.items(), key=lambda x: x[1])
    dominant_issues = [axis for axis, score in sorted_axes[:2] if score < 50]

    return TendencyHistoryResponse(
        scores=scores,
        dominant_issues=dominant_issues,
        axis_labels=AXIS_LABELS,
        updatedAt=data.get("updatedAt"),
    )


@router.get("/recommendation", response_model=RecommendationResponse)
def recommendation(
    uid: str = Depends(get_current_uid),
    hormone: int = 50,
    circadian: int = 50,
    blood_flow: int = 50,
    stress: int = 50,
) -> RecommendationResponse:
    """
    スコアに基づいて推奨アクションを返す。

    Query params:
        hormone, circadian, blood_flow, stress: 各軸のスコア（0-100）

    Response:
        { "actions": [{ "name": "早寝", "reason": "...", "targets": [...], ... }], "axis_labels": {...} }
    """
    scores = {
        "hormone": hormone,
        "circadian": circadian,
        "blood_flow": blood_flow,
        "stress": stress,
    }
    actions = get_recommended_actions(scores, max_actions=5)
    return RecommendationResponse(
        actions=[dict(a) for a in actions],
        axis_labels=AXIS_LABELS,
    )
