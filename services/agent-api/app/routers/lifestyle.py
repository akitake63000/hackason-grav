from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import logging
import random
import re
import uuid
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from google.cloud import storage as gcs
from google.cloud.firestore_v1.field_path import FieldPath
from google.cloud.exceptions import GoogleCloudError
from firebase_admin.exceptions import FirebaseError
from firebase_admin import firestore

from ..auth import get_current_uid
from ..config import FIREBASE_STORAGE_BUCKET, GEMINI_MODEL, GEMINI_MODEL_LIGHT
from ..firebase import get_firestore_client
from ..middleware.rate_limit import limiter
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
from ..agents.lifestyle_agent.tools.generate_plan import generate_weekly_plan, generate_daily_actions
from ..agents.lifestyle_agent.tools.analyze_user_activity import analyze_user_activity, UserActivityMetrics

router = APIRouter(prefix="/api/v1/lifestyle", tags=["lifestyle"])


class TipResponse(BaseModel):
    tip: str
    source: str


class TendencyRequest(BaseModel):
    """問診回答リクエスト"""
    answers: dict[str, str] = Field(..., description="Questionnaire answers (max 50 keys, max 500 chars per value)")

    @field_validator('answers')
    @classmethod
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
    summary: str | None = None


class RecommendationResponse(BaseModel):
    """推奨アクションレスポンス"""
    grouped_actions: dict[str, list[dict]]
    axis_labels: dict[str, dict[str, str]]
    summary: str | None = None


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
@limiter.limit("300/minute")
def health(request: Request) -> dict:
    return {"status": "ok"}


@router.get("/tip", response_model=TipResponse)
@limiter.limit("20/minute")
def tip(request: Request, _: str = Depends(get_current_uid)) -> TipResponse:
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
    except (ValueError, RuntimeError) as e:
        logging.warning(f"Failed to generate tip with Gemini: {e}")
        return TipResponse(tip=_fallback_tip(season), source="fallback")
    except Exception as e:
        logging.error(f"Unexpected error in tip generation: {e}", exc_info=True)
        return TipResponse(tip=_fallback_tip(season), source="fallback")


# ---------------------------------------------------------------------------
# GET /mission — パーソナライズされた今日のミッション
# ---------------------------------------------------------------------------

class MissionAction(BaseModel):
    """Individual mission action"""
    id: str
    name: str  # "写真撮影から3日経過しています"
    emoji: str  # "📸"
    description: str  # Detailed explanation
    actionType: str  # "reminder" | "encouragement" | "challenge"
    targetUrl: str | None  # Navigation URL (e.g., "/feature1/capture")
    priority: str  # "high" | "medium" | "low"


class MissionResponse(BaseModel):
    """Daily missions response"""
    missions: list[MissionAction]  # Always 3 missions
    source: str  # "personalized" | "fallback"
    generatedAt: str


def _get_fallback_missions(metrics: UserActivityMetrics) -> list[MissionAction]:
    """Generate static missions based on user metrics (fallback when Gemini fails)"""
    missions = []

    # Mission 1: Photo reminder (if 3+ days since last photo or never captured)
    if metrics["days_since_last_photo"] is None or metrics["days_since_last_photo"] >= 3:
        missions.append(MissionAction(
            id="fallback_photo",
            name="今日の状態を写真で記録しましょう",
            emoji="📸",
            description="定期的な記録が進捗把握に役立ちます。",
            actionType="reminder",
            targetUrl="/feature1/capture",
            priority="high"
        ))

    # Mission 2: Streak encouragement (if streak >= 3) or Plan check (if streak < 3)
    if metrics["current_streak"] >= 3:
        missions.append(MissionAction(
            id="fallback_streak",
            name=f"{metrics['current_streak']}日連続達成中!",
            emoji="🔥",
            description="この調子で継続しましょう。",
            actionType="encouragement",
            targetUrl=None,
            priority="medium"
        ))
    else:
        missions.append(MissionAction(
            id="fallback_plan",
            name="今日のプランをチェックしましょう",
            emoji="✅",
            description="3つのアクションを実践して継続記録を伸ばしましょう。",
            actionType="reminder",
            targetUrl="/feature3/weekly-plan",
            priority="high"
        ))

    # Mission 3: Weak axis-based action suggestion
    axis_actions = {
        "hormone": ("23時までの就寝", "🌙", "成長ホルモン分泌を促進しましょう。"),
        "circadian": ("朝日を浴びる", "☀️", "体内時計をリセットしましょう。"),
        "blood_flow": ("頭皮マッサージ", "💆", "血行を促進しましょう。"),
        "stress": ("深呼吸をする", "🌬️", "リラックスタイムを作りましょう。")
    }

    action_data = axis_actions.get(
        metrics["weakest_axis"],
        ("リラックスタイム", "😌", "心身を整えましょう。")
    )
    missions.append(MissionAction(
        id="fallback_axis",
        name=action_data[0],
        emoji=action_data[1],
        description=action_data[2],
        actionType="challenge",
        targetUrl=None,
        priority="medium"
    ))

    # Ensure exactly 3 missions
    return missions[:3]


async def _generate_missions_with_gemini(
    metrics: UserActivityMetrics,
    answers: dict
) -> list[MissionAction]:
    """Generate personalized missions using Gemini AI"""

    # Build user context in natural language
    days_since_photo = metrics["days_since_last_photo"]
    photo_status = f"最終撮影から{days_since_photo}日経過" if days_since_photo is not None else "写真未撮影"

    user_context = f"""
- 写真撮影: {photo_status}
- 食事記録: 先週{metrics['meals_logged_last_week']}回記録
- 継続記録: {metrics['current_streak']}日連続
- 弱点軸: {metrics['weakest_axis']}（スコア{metrics['weakest_score']}）
- 活動レベル: {metrics['engagement_level']}
    """

    prompt = f"""
あなたは薄毛対策アプリの「今日のミッション」生成AIです。
ユーザーの行動履歴を分析し、今日取り組むべき3つのミッションを提案してください。

## ユーザーの状況
{user_context}

## ミッション生成ルール
1. 必ず3つのミッションを生成
2. 優先順位: 長期間未実施 > 弱軸改善 > ポジティブ励まし
3. トーン: 優しく、前向き、押し付けがましくない
4. 具体性: 「今日やるべきこと」を明確に

## actionType の定義
- "reminder": 長期間実施していないことのリマインダー
- "encouragement": 継続中の行動への励まし
- "challenge": 新しいチャレンジ提案

## targetUrl の定義
- 写真撮影: "/feature1/capture"
- 食事記録: "/feature3/food-recommend"
- プラン確認: "/feature3/weekly-plan"
- その他: null

## 出力形式（JSON）
{{
  "missions": [
    {{
      "id": "mission_1",
      "name": "写真撮影から3日経過しています",
      "emoji": "📸",
      "description": "定期的な記録が大切です。今日の状態を記録して変化を追いましょう。",
      "actionType": "reminder",
      "targetUrl": "/feature1/capture",
      "priority": "high"
    }},
    {{
      "id": "mission_2",
      "name": "7日連続達成！この調子です",
      "emoji": "🔥",
      "description": "継続することで習慣化につながります。",
      "actionType": "encouragement",
      "targetUrl": null,
      "priority": "medium"
    }},
    {{
      "id": "mission_3",
      "name": "頭皮マッサージで血行促進",
      "emoji": "💆",
      "description": "指の腹で優しく揉みほぐしましょう。",
      "actionType": "challenge",
      "targetUrl": null,
      "priority": "medium"
    }}
  ]
}}
    """

    try:
        response = generate_text(prompt, model=GEMINI_MODEL_LIGHT)
        data = safe_json_load(response)

        if not data or "missions" not in data:
            logging.warning("Gemini response missing 'missions' field")
            return []

        missions = []
        for m in data.get("missions", [])[:3]:
            try:
                missions.append(MissionAction(
                    id=m.get("id", f"gemini_{uuid.uuid4().hex[:8]}"),
                    name=m["name"],
                    emoji=m.get("emoji", "💡"),
                    description=m["description"],
                    actionType=m.get("actionType", "challenge"),
                    targetUrl=m.get("targetUrl"),
                    priority=m.get("priority", "medium")
                ))
            except (KeyError, ValueError) as e:
                logging.warning(f"Failed to parse mission: {e}")
                continue

        # If less than 3, supplement with fallback
        while len(missions) < 3:
            fallback_missions = _get_fallback_missions(metrics)
            for fb_mission in fallback_missions:
                if len(missions) >= 3:
                    break
                # Avoid duplicates by checking ID prefix
                if not any(m.id.startswith("fallback_") for m in missions):
                    missions.append(fb_mission)
                    break

        return missions[:3]

    except Exception as e:
        logging.error(f"Gemini mission generation failed: {e}", exc_info=True)
        return []


@router.get("/mission", response_model=MissionResponse)
@limiter.limit("30/minute")
async def get_daily_missions(
    request: Request,
    uid: str = Depends(get_current_uid)
) -> MissionResponse:
    """
    Generate 3 personalized daily missions based on comprehensive user activity analysis

    Caching strategy: Generates missions once per day (Asia/Tokyo timezone)
    - Cached missions are stored in Firestore: users/{uid}/dailyMissions/{YYYY-MM-DD}
    - Missions are reused throughout the day to avoid unnecessary API calls
    - Old missions (8+ days) are automatically cleaned up

    Analyzes:
    - Photo capture history (last photo date, frequency)
    - Meal logging history (recent activity, trends)
    - Plan completion status (streak, completion rate)
    - 4-axis tendency scores (weakest point)

    Returns:
        MissionResponse with 3 missions, source (personalized/fallback/cached), and timestamp
    """
    db = get_firestore_client()
    now = datetime.now(ZoneInfo("Asia/Tokyo"))
    today_str = now.strftime("%Y-%m-%d")

    # 1. Check for cached missions (today's missions already generated)
    try:
        cached_mission_doc = db.collection("users").document(uid)\
            .collection("dailyMissions").document(today_str).get()

        if cached_mission_doc.exists:
            cached_data = cached_mission_doc.to_dict()
            missions_data = cached_data.get("missions", [])

            if missions_data and len(missions_data) == 3:
                logging.info(f"Using cached missions for {today_str}")
                missions = [MissionAction(**m) for m in missions_data]
                return MissionResponse(
                    missions=missions,
                    source=f"{cached_data.get('source', 'cached')}:cached",
                    generatedAt=cached_data.get("generatedAt", now.isoformat())
                )
    except Exception as e:
        logging.warning(f"Failed to fetch cached missions: {e}")

    # 2. Generate new missions (no cache found or cache invalid)
    # 2.1 Analyze user activity across all features
    try:
        metrics = await analyze_user_activity(uid, db)
    except Exception as e:
        logging.error(f"Failed to analyze user activity: {e}", exc_info=True)
        # Use safe defaults if analysis fails
        metrics: UserActivityMetrics = {
            "days_since_last_photo": None,
            "photo_frequency": "inactive",
            "meals_logged_last_week": 0,
            "meal_logging_trend": "stable",
            "current_streak": 0,
            "plan_completion_rate": 0.0,
            "weakest_axis": "stress",
            "weakest_score": 50,
            "engagement_level": "low"
        }

    # 2.2 Fetch questionnaire answers for context
    answers = {}
    try:
        tendency_doc = db.collection("users").document(uid)\
            .collection("tendencyScores").document("latest").get()
        if tendency_doc.exists:
            data = tendency_doc.to_dict()
            answers = data.get("answers", {})
    except Exception as e:
        logging.warning(f"Failed to fetch tendency answers: {e}")

    # 2.3 Generate missions with Gemini (with fallback)
    missions = []
    source = "fallback"

    if gemini_enabled():
        try:
            missions = await _generate_missions_with_gemini(metrics, answers)
            if missions and len(missions) == 3:
                source = "personalized"
        except Exception as e:
            logging.error(f"Gemini mission generation failed: {e}", exc_info=True)

    # 2.4 Use fallback if Gemini failed or returned incomplete results
    if not missions or len(missions) < 3:
        logging.info("Using fallback missions")
        missions = _get_fallback_missions(metrics)
        source = "fallback"

    # 3. Save missions to Firestore cache (for reuse throughout the day)
    try:
        missions_data = [m.model_dump() for m in missions]
        db.collection("users").document(uid).collection("dailyMissions").document(today_str).set({
            "date": today_str,
            "missions": missions_data,
            "source": source,
            "generatedAt": now.isoformat(),
            "createdAt": firestore.SERVER_TIMESTAMP
        })
        logging.info(f"Saved missions to cache for {today_str}")
    except Exception as e:
        logging.error(f"Failed to save missions to cache: {e}", exc_info=True)

    # 4. Clean up old missions (8+ days ago)
    try:
        cutoff_date = (now - timedelta(days=8)).strftime("%Y-%m-%d")
        old_missions = db.collection("users").document(uid)\
            .collection("dailyMissions")\
            .where("date", "<", cutoff_date)\
            .limit(50).stream()

        deleted_count = 0
        for old_mission in old_missions:
            old_mission.reference.delete()
            deleted_count += 1

        if deleted_count > 0:
            logging.info(f"Deleted {deleted_count} old mission records (before {cutoff_date})")
    except Exception as e:
        logging.warning(f"Failed to clean up old missions: {e}")

    # 5. Return response
    return MissionResponse(
        missions=missions,
        source=source,
        generatedAt=now.isoformat()
    )


# ---------------------------------------------------------------------------
# POST /meal-analyze — 食事画像の栄養分析
# ---------------------------------------------------------------------------

class MealAnalyzeRequest(BaseModel):
    storagePath: str = Field(..., min_length=1, max_length=500, description="Firebase Storage path (users/{uid}/meals/xxx.jpg)")

    @field_validator('storagePath')
    @classmethod
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
@limiter.limit("10/minute")
def meal_analyze(
    request: Request,
    req: MealAnalyzeRequest,
    uid: str = Depends(get_current_uid),
) -> MealAnalyzeResponse:
    # Gemini が無効な場合はフォールバック
    if not _raw_gemini_enabled():
        return _fallback_meal_analysis()

    try:
        image_bytes = _download_image_from_storage(req.storagePath)
    except (GoogleCloudError, ValueError) as e:
        logging.error(f"Failed to download image from Storage ({req.storagePath}): {e}")
        return _fallback_meal_analysis()
    except Exception as e:
        logging.error(f"Unexpected error downloading image from Storage ({req.storagePath}): {e}", exc_info=True)
        return _fallback_meal_analysis()

    try:
        result = _analyze_with_gemini(image_bytes)
    except (ValueError, json.JSONDecodeError, RuntimeError) as e:
        logging.warning(f"Gemini meal analysis failed: {e}")
        return _fallback_meal_analysis()
    except Exception as e:
        logging.error(f"Unexpected error in Gemini meal analysis: {e}", exc_info=True)
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
    except (FirebaseError, GoogleCloudError) as e:
        logging.error(f"Failed to save meal analysis to Firestore: {e}")
        # 保存失敗でもレスポンスは返す
    except Exception as e:
        logging.error(f"Unexpected error saving meal analysis to Firestore: {e}", exc_info=True)
        # 保存失敗でもレスポンスは返す

    return result

# ============================================================
# 傾向分析 API
# ============================================================


@router.post("/tendency", response_model=TendencyResponse)
@limiter.limit("30/minute")
def tendency(
    request: Request,
    req: TendencyRequest,
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
    except (FirebaseError, GoogleCloudError) as e:
        logging.error(f"Firestore error fetching hair analysis: {e}")
    except Exception as e:
        logging.error(f"Unexpected error fetching hair analysis: {e}", exc_info=True)

    # 2. スコア算出
    result = analyze_tendency_scores(req.answers, hair_analysis=hair_analysis)
    scores = result["scores"]

    # 3. Generate AI Summary
    summary = None
    model = GEMINI_MODEL_LIGHT or GEMINI_MODEL
    if gemini_enabled(model):
        try:
            # Construct a brief context for Gemini
            axis_info = ""
            for axis, score in scores.items():
                label = AXIS_LABELS.get(axis, {}).get("name", axis)
                axis_info += f"- {label}: {score}点\n"
            
            prompt = (
                "あなたは毛髪と生活習慣の専門アドバイザーです。"
                "以下の4軸スコアに基づく現在の状態の分析と、今後の改善に向けた励ましの言葉を、日本語で2〜3文（100文字程度）で作成してください。"
                "【スコア結果】\n"
                f"{axis_info}"
                "\n回答は要約のみを出力してください。"
            )
            summary = generate_text(prompt, model=model).strip()
        except Exception as e:
            logging.error(f"Failed to generate tendency summary: {e}", exc_info=True)

    # 4. Firestore に保存
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
                "answers": req.answers,  # Save answers for recommendation filtering
                "summary": summary,
                "updatedAt": datetime.now(ZoneInfo("Asia/Tokyo")),
                "hairlineScoreSource": hair_analysis.get("hairlineScore")
                if hair_analysis
                else None,
            }
        )
    except Exception as e:
        logging.error(f"Error saving tendency scores to Firestore: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save analysis results")

    return TendencyResponse(
        scores=scores,
        dominant_issues=result["dominant_issues"],
        axis_labels=AXIS_LABELS,
        summary=summary,
    )


class TendencyHistoryResponse(TendencyResponse):
    updatedAt: datetime | None = None


@router.get("/tendency/latest", response_model=TendencyHistoryResponse)
@limiter.limit("60/minute")
def get_latest_tendency(
    request: Request,
    uid: str = Depends(get_current_uid),
) -> TendencyHistoryResponse:
    """
    最新の診断結果を取得する。
    存在しない場合は 404 を返す。
    """

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
        summary=data.get("summary"),
        updatedAt=data.get("updatedAt"),
    )


@router.get("/recommendation", response_model=RecommendationResponse)
@limiter.limit("30/minute")
def recommendation(
    request: Request,
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

    summary = None

    # Fetch latest answers for filtering
    answers = {}
    try:
        db = get_firestore_client()
        doc = db.collection("users").document(uid).collection("tendencyScores").document("latest").get()
        if doc.exists:
            data = doc.to_dict()
            answers = data.get("answers", {})
            summary = data.get("summary")
    except Exception as e:
        logging.error(f"Error fetching answers for recommendation: {e}", exc_info=True)

    grouped_actions = get_recommended_actions(
        scores, 
        answers=answers, 
        max_actions_per_axis=8, 
        ignore_scores=True
    )
    
    return RecommendationResponse(
        grouped_actions=grouped_actions,
        axis_labels=AXIS_LABELS,
        summary=summary,
    )


# ============================================================
# Weekly Action Plan API
# ============================================================

class ActionCheckRequest(BaseModel):
    planId: str
    actionId: str
    date: str  # YYYY-MM-DD
    completed: bool

class PlanResponse(BaseModel):
    # Plan info
    planId: str | None
    theme: str | None
    targetActions: list[dict] = []
    startDate: str | None
    endDate: str | None
    status: str = "none" # none, active, completed
    
    # Today's status
    currentViewDate: str | None = None
    todayLog: dict | None = None # { completedActions: [] }
    yesterdayLog: dict | None = None # { completedActions: [], date: "YYYY-MM-DD" }
    weeklyStats: dict | None = None # { rate: int, message: str, totalCompleted: int }
    streak: int = 0  # Consecutive days completed
    weeklyProgress: int = 0 # Points (0-105)
    isTodayConfirmed: bool = False


@router.post("/plan/generate", response_model=PlanResponse)
@limiter.limit("10/minute")
def generate_plan(
    request: Request,
    uid: str = Depends(get_current_uid),
) -> PlanResponse:
    """最新の診断結果から週間プランを作成する（テーマのみ決定）"""
    db = get_firestore_client()
    
    # 1. Fetch latest tendency
    doc_ref = db.collection("users").document(uid).collection("tendencyScores").document("latest")
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=400, detail="Diagnosis required before generating plan")
        
    data = doc.to_dict()
    scores = {
        "hormone": data.get("hormonal", 0),
        "blood_flow": data.get("bloodCirculation", 0),
        "circadian": data.get("circadian", 0),
        "stress": data.get("stress", 0),
    }
    answers = data.get("answers", {})

    # 2. Generate Plan (Theme & Dates)
    plan_data = generate_weekly_plan(scores, answers)
    plan_data["status"] = "active"
    
    # 3. Save to Firestore
    # Invalidate old active plans
    plans_ref = db.collection("users").document(uid).collection("plans")
    active_plans = plans_ref.where("status", "==", "active").stream()
    for active_plan in active_plans:
        active_plan.reference.update({"status": "completed"})

    # Set new one
    db.collection("users").document(uid).collection("plans").document(plan_data["planId"]).set(plan_data)
    
    # 4. Generate Daily Actions for "Day 1" (Optional: User can trigger it manually too, but nice to have for start)
    # Let's generate it immediately so start feels good.
    actions = generate_daily_actions(scores, answers)
    
    # Save to today's log
    now = datetime.now(ZoneInfo("Asia/Tokyo"))
    today_str = now.strftime("%Y-%m-%d")
    if now.hour < 4:
         today_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    
    db.collection("users").document(uid).collection("plans").document(plan_data["planId"]).collection("dailyActions").document(today_str).set({
        "actions": actions,
        "createdAt": now.isoformat()
    })
    
    plan_data["targetActions"] = actions
    
    return PlanResponse(
        planId=plan_data["planId"],
        theme=plan_data["theme"],
        targetActions=actions,
        startDate=plan_data["startDate"],
        endDate=plan_data["endDate"],
        status="active",
        todayLog={"completedActions": []},
        streak=0,
        weeklyProgress=0
    )


@router.post("/plan/daily/generate", response_model=PlanResponse)
@limiter.limit("10/minute")
def generate_daily(
    request: Request,
    uid: str = Depends(get_current_uid),
) -> PlanResponse:
    """今日のアクションを手動で生成する"""
    db = get_firestore_client()
    
    # 1. Get active plan
    plans_ref = db.collection("users").document(uid).collection("plans")
    query = plans_ref.where("status", "==", "active").limit(1)
    docs = query.get()
    
    if not docs:
         raise HTTPException(status_code=404, detail="No active plan found")
         
    plan_doc = docs[0]
    plan_data = plan_doc.to_dict()
    
    # 2. Fetch tendency for context
    doc_ref = db.collection("users").document(uid).collection("tendencyScores").document("latest")
    doc = doc_ref.get()
    scores = {}
    answers = {}
    if doc.exists:
        data = doc.to_dict()
        scores = {
            "hormone": data.get("hormonal", 0),
            "blood_flow": data.get("bloodCirculation", 0),
            "circadian": data.get("circadian", 0),
            "stress": data.get("stress", 0),
        }
        answers = data.get("answers", {})

    # 3. Generate Actions
    # Use history to avoid duplicates? (Feature for later)
    actions = generate_daily_actions(scores, answers)
    
    # 4. Determine Target Date (Today vs Tomorrow)
    now = datetime.now(ZoneInfo("Asia/Tokyo"))
    today_str = now.strftime("%Y-%m-%d")
    if now.hour < 4:
         today_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")

    # Check if today is already confirmed
    log_doc = plan_doc.reference.collection("logs").document(today_str).get()
    is_today_confirmed = False
    if log_doc.exists:
        data = log_doc.to_dict()
        if data.get("isConfirmed"):
            is_today_confirmed = True

    target_date_str = today_str
    if is_today_confirmed:
        # If confirmed, generate for tomorrow (relative to "today")
        target_date_obj = datetime.strptime(today_str, "%Y-%m-%d") + timedelta(days=1)
        target_date_str = target_date_obj.strftime("%Y-%m-%d")

    # 5. Save Actions
    plan_doc.reference.collection("dailyActions").document(target_date_str).set({
        "actions": actions,
        "createdAt": now.isoformat()
    })
    
    # 6. Return Response
    # Fetch log for the target view date
    view_log_doc = plan_doc.reference.collection("logs").document(target_date_str).get()
    view_log = {"completedActions": []}
    if view_log_doc.exists:
        view_log = view_log_doc.to_dict()
        
    return PlanResponse(
        planId=plan_data["planId"],
        theme=plan_data["theme"],
        targetActions=actions,
        startDate=plan_data["startDate"],
        endDate=plan_data["endDate"],
        status="active",
        currentViewDate=target_date_str,
        todayLog=view_log,
        streak=_calculate_streak(plan_doc),
        weeklyProgress=_calculate_weekly_progress(plan_doc.reference, today_str),
        isTodayConfirmed=is_today_confirmed
    )


def _calculate_streak(plan_doc) -> int:
    """Calculate consecutive days with at least 1 action completed"""
    try:
        # Simply count backwards from yesterday
        # Or check logs
        # Note: direction="DESCENDING" -> firestore.Query.DESCENDING
        logs = plan_doc.reference.collection("logs").order_by(FieldPath.document_id(), direction=firestore.Query.DESCENDING).limit(14).stream()
        
        # Logic: Check consecutive dates
        streak = 0
        now = datetime.now(ZoneInfo("Asia/Tokyo"))
        # Check yesterday backwards
        check_date = now - timedelta(days=1)
        if now.hour < 4:
            check_date = now - timedelta(days=2)
            
        # Map logs to dict
        log_map = {}
        for log in logs:
            data = log.to_dict()
            if data.get("completedActions"):
                log_map[log.id] = True
                
        # Also check today? If today has completion, streak includes today
        today_str = now.strftime("%Y-%m-%d")
        if now.hour < 4:
            today_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")
            
        if log_map.get(today_str):
            streak += 1
            
        # Count backwards
        for i in range(14): # Check up to 2 weeks
            d_str = check_date.strftime("%Y-%m-%d")
            if log_map.get(d_str):
                streak += 1
                check_date -= timedelta(days=1)
            else:
                break
                
        return streak
    except Exception as e:
        logging.error(f"Error calculating streak: {e}", exc_info=True)
        return 0


def _calculate_weekly_progress(plan_ref, today_str: str) -> int:
    """Calculate points based on completed actions (5 points each). 
    Counts confirmed days OR days that have passed (auto-save).
    """
    try:
        logs = plan_ref.collection("logs").stream()
        total_points = 0
        for log in logs:
            log_id = log.id # YYYY-MM-DD
            data = log.to_dict()
            # Count if manually confirmed OR if the day has passed
            if data.get("isConfirmed") or log_id < today_str:
                total_points += len(data.get("completedActions", [])) * 5
        
        return total_points
    except Exception as e:
        logging.error(f"Error calculating weekly progress: {e}", exc_info=True)
        return 0
@router.get("/plan/current", response_model=PlanResponse)
@limiter.limit("60/minute")
def get_current_plan(
    request: Request,
    uid: str = Depends(get_current_uid),
) -> PlanResponse:
    """現在進行中のプランと本日のログを取得"""
    db = get_firestore_client()
    
    # 1. Find active plan
    plans_ref = db.collection("users").document(uid).collection("plans")
    query = plans_ref.where("status", "==", "active").limit(1)
    docs = query.get()
    
    if not docs:
        return PlanResponse(planId=None, theme=None, startDate=None, endDate=None)
    
    plan_doc = docs[0]
    plan_data = plan_doc.to_dict()
    
    # 2. Check and handle expiration
    now = datetime.now(ZoneInfo("Asia/Tokyo"))
    
    def _parse_date(v):
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            try:
                # Handle possible 'Z' or offset
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except Exception as e:
                logging.error(f"Error parsing date string '{v}': {e}", exc_info=True)
                return datetime.now(ZoneInfo("Asia/Tokyo"))
        return datetime.now(ZoneInfo("Asia/Tokyo"))

    try:
        end_date = _parse_date(plan_data.get("endDate"))
        weekly_stats = None
        if now > end_date and now.date() > end_date.date():
             # Calculate weekly stats
             log_docs = plan_doc.reference.collection("logs").stream()
             total_completed = sum(len(l.to_dict().get("completedActions", [])) for l in log_docs)
             start_date_parsed = _parse_date(plan_data.get("startDate"))
             total_days = (end_date.date() - start_date_parsed.date()).days + 1
             rate = min(100, int((total_completed / max(1, total_days * 3)) * 100))
             weekly_stats = {
                 "rate": rate,
                 "totalCompleted": total_completed,
                 "message": "お疲れさま！" if rate >= 70 else "次週もがんばろう！"
             }
             # Update status to completed
             plan_doc.reference.update({"status": "completed"})
             plan_data["status"] = "completed"
    except Exception as e:
        logging.error(f"Error handling plan expiration: {e}", exc_info=True)
        weekly_stats = None

    # 3. Determine view date (Auto-advance if today is confirmed)
    current_date_obj = now
    if now.hour < 4:
        current_date_obj = now - timedelta(days=1)
        
    today_str = current_date_obj.strftime("%Y-%m-%d")
    
    # Check today's confirmation
    today_log_doc = plan_doc.reference.collection("logs").document(today_str).get()
    is_today_confirmed = False
    if today_log_doc.exists:
        is_today_confirmed = today_log_doc.to_dict().get("isConfirmed", False)

    view_date_obj = current_date_obj
    if is_today_confirmed:
        # Advance to tomorrow if today is already done
        view_date_obj = current_date_obj + timedelta(days=1)
    
    view_date_str = view_date_obj.strftime("%Y-%m-%d")

    # 4. Fetch Actions for view date
    daily_actions_doc = plan_doc.reference.collection("dailyActions").document(view_date_str).get()
    view_actions = []
    if daily_actions_doc.exists:
        view_actions = daily_actions_doc.to_dict().get("actions", [])
    
    # 5. Get logs for view date
    view_log_doc = plan_doc.reference.collection("logs").document(view_date_str).get()
    view_log = {"completedActions": [], "isConfirmed": False}
    if view_log_doc.exists:
        view_log = view_log_doc.to_dict()
        if "isConfirmed" not in view_log:
            view_log["isConfirmed"] = False
        
    # 6. Get Yesterday's log (Always relative to actual "today")
    yesterday_date_obj = current_date_obj - timedelta(days=1)
    yesterday_str = yesterday_date_obj.strftime("%Y-%m-%d")
    yesterday_doc = plan_doc.reference.collection("logs").document(yesterday_str).get()
    
    yesterday_log = {"completedActions": [], "date": yesterday_str}
    if yesterday_doc.exists:
        data = yesterday_doc.to_dict()
        yesterday_log["completedActions"] = data.get("completedActions", [])

    return PlanResponse(
        planId=plan_doc.id,
        theme=plan_data.get("theme"),
        targetActions=view_actions,
        startDate=plan_data.get("startDate"),
        endDate=plan_data.get("endDate"),
        status=plan_data.get("status", "none"),
        currentViewDate=view_date_str,
        todayLog=view_log,
        yesterdayLog=yesterday_log,
        weeklyStats=weekly_stats,
        streak=_calculate_streak(plan_doc),
        weeklyProgress=_calculate_weekly_progress(plan_doc.reference, today_str),
        isTodayConfirmed=view_log.get("isConfirmed", False)
    )


@router.post("/plan/check")
@limiter.limit("100/minute")
def check_action(
    request: Request,
    req: ActionCheckRequest,
    uid: str = Depends(get_current_uid),
):
    """アクションの実行状態を保存"""
    db = get_firestore_client()
    
    plan_ref = db.collection("users").document(uid).collection("plans").document(req.planId)
    log_ref = plan_ref.collection("logs").document(req.date)
    
    if req.completed:
        log_ref.set({"completedActions": firestore.ArrayUnion([req.actionId])}, merge=True)
    else:
        log_ref.set({"completedActions": firestore.ArrayRemove([req.actionId])}, merge=True)
        
    return {"status": "updated"}


class PlanConfirmRequest(BaseModel):
    planId: str
    date: str  # YYYY-MM-DD


@router.post("/plan/confirm")
@limiter.limit("20/minute")
def confirm_day(
    request: Request,
    req: PlanConfirmRequest,
    uid: str = Depends(get_current_uid),
):
    """一日のアクションを確定し、スコアを反映させる"""
    db = get_firestore_client()
    
    plan_ref = db.collection("users").document(uid).collection("plans").document(req.planId)
    log_ref = plan_ref.collection("logs").document(req.date)
    
    log_doc = log_ref.get()
    if not log_doc.exists:
        # Create empty log if not exists to mark as confirmed
        log_ref.set({"completedActions": [], "isConfirmed": True, "updatedAt": datetime.now(ZoneInfo("Asia/Tokyo"))})
    else:
        log_ref.update({"isConfirmed": True, "updatedAt": datetime.now(ZoneInfo("Asia/Tokyo"))})
        
    return {"status": "confirmed"}
