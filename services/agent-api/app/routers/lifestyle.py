from datetime import datetime
from zoneinfo import ZoneInfo
import random
import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..auth import get_current_uid
from ..config import GEMINI_MODEL, GEMINI_MODEL_LIGHT
from ..services.gemini_chat import gemini_enabled, generate_text
from ..firebase import get_firestore_client
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
    answers: dict[str, str]


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

