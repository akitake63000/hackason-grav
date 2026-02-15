from datetime import datetime, timedelta, time
from zoneinfo import ZoneInfo
from typing import Optional
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
from ..storage import validate_storage_path, download_image_bytes
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
# GET /quick-action — クイックアクション提案
# ---------------------------------------------------------------------------

class QuickActionResponse(BaseModel):
    """Quick action response"""
    action: str  # アクション説明（例: 「朝食に亜鉛豊富なナッツを追加」）
    time_label: str  # 時間帯ラベル（朝/昼/夜）
    guide: str  # 実行ガイド（「今すぐ始める」で表示）
    duration_minutes: int  # 所要時間（5分固定）
    source: str  # "generated" | "cached" | "fallback"
    generatedAt: str


FALLBACK_QUICK_ACTIONS = {
    "朝": {
        "action": "朝食に亜鉛豊富なナッツを追加",
        "guide": "1. アーモンド、カシューナッツ、くるみなどを用意\n2. 朝食に一握り（20-30g）追加\n3. よく噛んで食べる",
    },
    "昼": {
        "action": "ランチ後の5分頭皮マッサージ",
        "guide": "1. 両手の指の腹を頭皮に当てる\n2. 円を描くように優しくマッサージ\n3. 前頭部→側頭部→後頭部の順に5分間",
    },
    "夜": {
        "action": "寝る前の首・肩ストレッチ",
        "guide": "1. 首をゆっくり前後左右に倒す（各10秒）\n2. 肩を大きく回す（前後各10回）\n3. 深呼吸しながらリラックス",
    },
}


def _get_quick_action_time_label(hour: int) -> str:
    """Simplified time label for quick actions (朝/昼/夜)"""
    if hour < 5:
        return "夜"  # 深夜は夜のアクションを提案
    elif hour < 11:
        return "朝"
    elif hour < 17:
        return "昼"
    else:
        return "夜"


def _build_quick_action_prompt(
    time_label: str,
    metrics: UserActivityMetrics,
    season: str
) -> str:
    """Build Gemini prompt for quick action generation"""
    return f"""あなたは薄毛対策アプリの生活習慣アドバイザーAIです。
ユーザーの活動データと現在の状況を分析して、今すぐ実行可能な5分アクションを1つ提案してください。

## 現在の状況
- 時間帯: {time_label}
- 季節: {season}
- ユーザーの弱点軸: {metrics['weakest_axis']} (スコア: {metrics['weakest_score']})
- エンゲージメント: {metrics['engagement_level']}
- 食事記録トレンド: {metrics['meal_logging_trend']}
- プラン実行状況: 連続{metrics['current_streak']}日、完了率{metrics['plan_completion_rate']:.0%}

## アクション生成ルール
1. 時間帯に適したアクション（朝: 栄養、昼: マッサージ/運動、夜: リラックス）
2. 5分以内で実行可能
3. 具体的で実行しやすい
4. 弱点軸の改善に寄与する内容を優先
5. 季節を考慮（夏: 水分補給、冬: 保温など）

## 出力形式（JSONのみ）
{{
  "action": "簡潔なアクション名（20文字以内）",
  "guide": "実行手順を3ステップで説明（各ステップ50文字以内）\\n1. ...\\n2. ...\\n3. ..."
}}

JSONのみ出力してください。"""


async def _get_cached_quick_action(
    uid: str,
    db: firestore.Client,
    date_str: str,
    time_label: str
) -> QuickActionResponse | None:
    """Retrieve cached quick action from Firestore"""
    try:
        doc_id = f"{date_str}_{time_label}"
        doc_ref = db.collection("users").document(uid).collection("quickActions").document(doc_id)
        doc = doc_ref.get()

        if doc.exists:
            data = doc.to_dict()
            # Check if cache is still valid (TTL not expired)
            ttl = data.get("ttl")
            if ttl:
                # timezone-awareの場合はastimezone、naiveの場合はreplaceを使用
                ttl_utc = ttl.astimezone(ZoneInfo("UTC")) if ttl.tzinfo else ttl.replace(tzinfo=ZoneInfo("UTC"))
                if ttl_utc > datetime.now(ZoneInfo("UTC")):
                    return QuickActionResponse(
                        action=data["action"],
                        time_label=data["time_label"],
                        guide=data["guide"],
                        duration_minutes=data.get("duration_minutes", 5),
                        source="cached",
                        generatedAt=data["generatedAt"]
                    )
    except Exception as e:
        logging.warning(f"Failed to retrieve cached quick action: {e}")

    return None


async def _cache_quick_action(
    uid: str,
    db: firestore.Client,
    date_str: str,
    time_label: str,
    action: str,
    guide: str,
    generated_at: str
) -> None:
    """Cache quick action to Firestore with TTL"""
    try:
        # Calculate TTL (next day 4:00 AM JST)
        now = datetime.now(ZoneInfo("Asia/Tokyo"))
        tomorrow = now.date() + timedelta(days=1)
        ttl = datetime.combine(tomorrow, datetime.min.time().replace(hour=4), tzinfo=ZoneInfo("Asia/Tokyo"))

        doc_id = f"{date_str}_{time_label}"
        doc_ref = db.collection("users").document(uid).collection("quickActions").document(doc_id)

        doc_ref.set({
            "action": action,
            "time_label": time_label,
            "guide": guide,
            "duration_minutes": 5,
            "source": "generated",
            "generatedAt": generated_at,
            "ttl": ttl
        })
    except Exception as e:
        logging.warning(f"Failed to cache quick action: {e}")


@router.get("/quick-action", response_model=QuickActionResponse)
@limiter.limit("30/minute")
async def quick_action(request: Request, uid: str = Depends(get_current_uid)) -> QuickActionResponse:
    """Generate time-based quick action suggestions"""
    now = datetime.now(ZoneInfo("Asia/Tokyo"))
    date_str = now.strftime("%Y-%m-%d")
    season = _season_label(now.month)
    time_label = _get_quick_action_time_label(now.hour)

    db = get_firestore_client()

    # Check cache first
    cached = await _get_cached_quick_action(uid, db, date_str, time_label)
    if cached:
        return cached

    # Get fallback action
    fallback_data = FALLBACK_QUICK_ACTIONS.get(time_label, FALLBACK_QUICK_ACTIONS["朝"])

    model = GEMINI_MODEL_LIGHT or GEMINI_MODEL

    # If Gemini is not available, return fallback
    if not gemini_enabled(model):
        return QuickActionResponse(
            action=fallback_data["action"],
            time_label=time_label,
            guide=fallback_data["guide"],
            duration_minutes=5,
            source="fallback",
            generatedAt=now.isoformat()
        )

    # Analyze user activity
    try:
        metrics = await analyze_user_activity(uid, db)
    except Exception as e:
        logging.warning(f"Failed to analyze user activity for quick action: {e}")
        # Use default metrics on error
        metrics = {
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

    # Generate with Gemini
    prompt = _build_quick_action_prompt(time_label, metrics, season)

    try:
        response_text = generate_text(prompt, model=model).strip()

        # Parse JSON response
        response_data = safe_json_load(response_text)

        if not response_data or "action" not in response_data or "guide" not in response_data:
            raise ValueError("Invalid response format from Gemini")

        action = response_data["action"].strip()
        guide = response_data["guide"].strip()

        if not action or not guide:
            raise ValueError("Empty action or guide from Gemini")

        generated_at = now.isoformat()

        # Cache the result
        await _cache_quick_action(uid, db, date_str, time_label, action, guide, generated_at)

        return QuickActionResponse(
            action=action,
            time_label=time_label,
            guide=guide,
            duration_minutes=5,
            source="generated",
            generatedAt=generated_at
        )

    except (ValueError, RuntimeError, KeyError) as e:
        logging.warning(f"Failed to generate quick action with Gemini: {e}")
        return QuickActionResponse(
            action=fallback_data["action"],
            time_label=time_label,
            guide=fallback_data["guide"],
            duration_minutes=5,
            source="fallback",
            generatedAt=now.isoformat()
        )
    except Exception as e:
        logging.error(f"Unexpected error in quick action generation: {e}", exc_info=True)
        return QuickActionResponse(
            action=fallback_data["action"],
            time_label=time_label,
            guide=fallback_data["guide"],
            duration_minutes=5,
            source="fallback",
            generatedAt=now.isoformat()
        )


# ---------------------------------------------------------------------------
# GET /quick-qa — クイックQ&A（concernAreas に基づく質問推奨）
# ---------------------------------------------------------------------------

class QuickQAResponse(BaseModel):
    """Quick Q&A response"""
    questions: list[str]  # 3つの質問
    source: str  # "personalized" | "fallback"
    generatedAt: str


# concernArea ごとの質問マッピング（各3つ）
CONCERN_QUESTIONS = {
    "thinning": [
        "細い髪を太くする方法はありますか？",
        "髪のハリ・コシを取り戻すには？",
        "栄養面で気をつけることは？"
    ],
    "hairline": [
        "生え際の後退を防ぐには？",
        "前髪のボリュームを保つコツは？",
        "マッサージは効果的ですか？"
    ],
    "crown": [
        "頭頂部の薄毛対策は？",
        "つむじの目立ちを抑えるには？",
        "血行改善の方法を教えて"
    ],
    "volume": [
        "ボリュームアップの方法は？",
        "ドライヤーの使い方のコツは？",
        "スタイリングで気をつけることは？"
    ],
    "shedding": [
        "抜け毛を減らすには？",
        "シャンプーの選び方は？",
        "ストレスと抜け毛の関係は？"
    ],
    "scalp": [
        "頭皮ケアのポイントは？",
        "頭皮の乾燥対策は？",
        "マッサージの正しいやり方は？"
    ],
    "stress": [
        "ストレス性の薄毛対策は？",
        "リラックス方法を教えて",
        "睡眠と髪の関係は？"
    ],
    "postpartum": [
        "産後脱毛はいつ戻りますか？",
        "授乳中でもできるケアは？",
        "栄養面で意識することは？"
    ],
    "prevention": [
        "今からできる予防法は？",
        "生活習慣で気をつけることは？",
        "頭皮環境を整えるには？"
    ]
}

FALLBACK_QUESTIONS = [
    "薄毛対策で一番大切なことは？",
    "今日からできるケアを教えて",
    "食事で気をつけることは？"
]

# 性別・年齢を考慮したパーソナライズ質問マッピング
# 構造: PERSONALIZED_QUESTIONS[concern][gender][age_group] = [questions]
PERSONALIZED_QUESTIONS = {
    "thinning": {
        "male": {
            "20s": [
                "20代男性のAGA、進行を止められる？",
                "若ハゲの原因と対策を教えて",
                "親族に薄毛が多い場合の予防法は？"
            ],
            "30s": [
                "30代のAGA治療、今始めるべき？",
                "仕事のストレスで抜け毛が増えた",
                "男性型脱毛症の初期症状は？"
            ],
            "40s+": [
                "40代からのAGA治療は遅い？",
                "加齢とAGAの違いを教えて",
                "ミノキシジルやフィナステリドの効果は？"
            ]
        },
        "female": {
            "20s": [
                "若い女性の薄毛、原因は何？",
                "ダイエットと髪の関係を教えて",
                "ヘアカラー・パーマは薄毛に影響する？"
            ],
            "30s": [
                "30代女性の薄毛、ホルモンの影響は？",
                "仕事と家庭の両立でストレスが…髪への影響は？",
                "女性用育毛剤は効果ある？"
            ],
            "40s+": [
                "更年期と薄毛の関係を教えて",
                "40代からの女性ホルモン減少対策は？",
                "閉経後のヘアケアで気をつけることは？"
            ]
        },
        "all": {
            "20s": [
                "20代の薄毛は回復可能？早期ケアのポイントは？",
                "若いうちから始めるべき頭皮ケアは？",
                "学生・新社会人でもできる予算内のケアは？"
            ],
            "30s": [
                "30代の薄毛対策、今からでも間に合う？",
                "仕事のストレスと薄毛の関係は？",
                "忙しい日々でも続けられるケア方法は？"
            ],
            "40s+": [
                "40代からの本格的な薄毛対策は？",
                "加齢による薄毛とホルモンバランスの関係は？",
                "効果が出やすいケア方法を教えて"
            ]
        }
    },
    "hairline": {
        "male": {
            "20s": [
                "M字ハゲの進行を止めたい",
                "20代で生え際が後退、どうすれば？",
                "前髪のセットで生え際を目立たせない方法は？"
            ],
            "30s": [
                "30代でM字が目立ってきた、対策は？",
                "生え際の後退を遅らせる方法は？",
                "おでこが広くなってきた…改善できる？"
            ],
            "40s+": [
                "40代の生え際後退、植毛は選択肢？",
                "前髪が薄くなった時のヘアスタイルは？",
                "生え際のケア、今からでも効果ある？"
            ]
        },
        "female": {
            "20s": [
                "前髪が薄くなってきた気がする",
                "生え際の産毛を太くする方法は？",
                "おでこの生え際ケア、何から始める？"
            ],
            "30s": [
                "30代女性、前髪のボリュームが減った",
                "生え際が目立つ時のヘアアレンジは？",
                "分け目を変えるべき？生え際の負担を減らす方法"
            ],
            "40s+": [
                "年齢とともに前髪が細くなる原因は？",
                "生え際の後退を目立たなくするカラーリングは？",
                "40代からの前髪ケア、効果的な方法は？"
            ]
        },
        "all": {
            "20s": [
                "生え際の後退を防ぐには？",
                "前髪のボリュームを保つコツは？",
                "生え際マッサージは効果的ですか？"
            ],
            "30s": [
                "生え際が気になり始めた…今できることは？",
                "前髪が薄い時のスタイリング術は？",
                "生え際の血行改善方法を教えて"
            ],
            "40s+": [
                "生え際の年齢変化、自然なこと？対策すべき？",
                "前髪エリアの育毛、何が効果的？",
                "生え際を守るヘアケア習慣は？"
            ]
        }
    },
    "crown": {
        "male": {
            "20s": [
                "つむじが薄い、AGAの始まり？",
                "20代でO字ハゲ、進行を止めたい",
                "頭頂部の薄毛、早期対策は何？"
            ],
            "30s": [
                "つむじ周りが透けて見える…治療すべき？",
                "30代のO字型AGA、効果的な対策は？",
                "頭頂部の薄毛、隠すより治す方法は？"
            ],
            "40s+": [
                "つむじの薄毛が目立つ、今からできることは？",
                "頭頂部の薄毛改善、40代からでも間に合う？",
                "O字ハゲの進行を遅らせるには？"
            ]
        },
        "female": {
            "20s": [
                "つむじが目立つのは髪質のせい？",
                "頭頂部のボリュームを出す方法は？",
                "分け目とつむじが気になる時の対策は？"
            ],
            "30s": [
                "30代女性、つむじ周りが薄い気がする",
                "頭頂部の分け目が広がってきた",
                "つむじの薄毛、ホルモンバランスの影響？"
            ],
            "40s+": [
                "更年期でつむじが薄くなる？",
                "頭頂部の薄毛、年齢的に仕方ない？",
                "つむじ周りの髪を増やす方法はある？"
            ]
        },
        "all": {
            "20s": [
                "頭頂部の薄毛対策は？",
                "つむじの目立ちを抑えるには？",
                "頭皮の血行改善の方法を教えて"
            ],
            "30s": [
                "つむじ周りが気になり始めた、何から？",
                "頭頂部のボリュームアップ方法は？",
                "つむじの薄毛予防、今できることは？"
            ],
            "40s+": [
                "年齢による頭頂部の変化、対策はある？",
                "つむじの薄毛改善、効果的な方法は？",
                "頭頂部の育毛ケア、何を試すべき？"
            ]
        }
    },
    "volume": {
        "male": {
            "20s": [
                "髪が細くて腰がない、太くできる？",
                "ボリュームが出ないヘアスタイルの悩み",
                "猫っ毛を改善する方法はある？"
            ],
            "30s": [
                "30代で髪のコシがなくなってきた",
                "ボリュームダウン、老けて見える…対策は？",
                "細くなった髪を太くする方法は？"
            ],
            "40s+": [
                "年齢とともに髪が細くペタンコに",
                "ボリュームアップのスタイリング術は？",
                "細い髪でも立体感を出すには？"
            ]
        },
        "female": {
            "20s": [
                "髪が細くてスタイリングが決まらない",
                "ボリュームが欲しい！パーマは逆効果？",
                "ぺったんこ髪をふんわりさせるには？"
            ],
            "30s": [
                "30代でボリュームが減った気がする",
                "出産後、髪が細くなった",
                "トップのボリュームを出す方法は？"
            ],
            "40s+": [
                "40代、髪のハリ・コシがなくなった",
                "ボリュームダウンを改善するケアは？",
                "年齢による髪の細さ、どうケアする？"
            ]
        },
        "all": {
            "20s": [
                "ボリュームアップの方法は？",
                "ドライヤーの使い方のコツは？",
                "スタイリングで気をつけることは？"
            ],
            "30s": [
                "髪のボリュームが減ってきた、原因は？",
                "ふんわりヘアを作るドライ方法は？",
                "ボリュームアップシャンプーは効果ある？"
            ],
            "40s+": [
                "年齢によるボリュームダウン、改善できる？",
                "ペタンコ髪を立ち上げるスタイリングは？",
                "ボリュームを保つヘアケア習慣は？"
            ]
        }
    },
    "shedding": {
        "male": {
            "20s": [
                "シャンプー時の抜け毛が多い、AGAの兆候？",
                "20代で抜け毛が増えた、原因は？",
                "抜け毛を減らす洗髪方法は？"
            ],
            "30s": [
                "30代で急に抜け毛が増えた",
                "ストレスと抜け毛の関係を知りたい",
                "抜け毛対策、何から始めるべき？"
            ],
            "40s+": [
                "40代の抜け毛、自然な老化？それとも対策必要？",
                "季節の変わり目に抜け毛が増える",
                "抜け毛を減らす生活習慣は？"
            ]
        },
        "female": {
            "20s": [
                "ブラッシング時の抜け毛が気になる",
                "シャンプーで髪が抜けるのは普通？異常？",
                "抜け毛を減らすシャンプー選びのコツは？"
            ],
            "30s": [
                "30代で抜け毛が増えた、ホルモンの影響？",
                "出産後の抜け毛がひどい",
                "季節性の抜け毛、対策はある？"
            ],
            "40s+": [
                "更年期で抜け毛が増える？",
                "40代の抜け毛、どこまでが正常範囲？",
                "抜け毛予防、今からできることは？"
            ]
        },
        "all": {
            "20s": [
                "抜け毛を減らすには？",
                "シャンプーの選び方は？",
                "ストレスと抜け毛の関係は？"
            ],
            "30s": [
                "急に抜け毛が増えた、何が原因？",
                "抜け毛が多い時のヘアケアは？",
                "抜け毛対策に効果的な栄養素は？"
            ],
            "40s+": [
                "年齢による抜け毛増加、対策は？",
                "抜け毛を減らす頭皮ケア方法は？",
                "抜け毛予防に効果的な習慣は？"
            ]
        }
    },
    "scalp": {
        "male": {
            "20s": [
                "頭皮が脂っぽい、薄毛に影響する？",
                "頭皮のかゆみと抜け毛の関係は？",
                "頭皮ケア、何から始めるべき？"
            ],
            "30s": [
                "30代で頭皮の乾燥が気になる",
                "頭皮環境と薄毛の関係を知りたい",
                "頭皮マッサージの正しいやり方は？"
            ],
            "40s+": [
                "頭皮が硬い、血行不良が薄毛の原因？",
                "40代の頭皮ケア、何を重視すべき？",
                "頭皮の老化を防ぐ方法は？"
            ]
        },
        "female": {
            "20s": [
                "頭皮が敏感で合うシャンプーがない",
                "頭皮のニオイが気になる、ケア方法は？",
                "頭皮の乾燥とフケ、どう改善する？"
            ],
            "30s": [
                "30代で頭皮トラブルが増えた",
                "頭皮のかゆみ・赤み、原因は何？",
                "頭皮環境を整えるケア方法は？"
            ],
            "40s+": [
                "更年期で頭皮が乾燥しやすくなった",
                "40代の頭皮ケア、保湿が大事？",
                "頭皮の老化サイン、どう対処する？"
            ]
        },
        "all": {
            "20s": [
                "頭皮ケアのポイントは？",
                "頭皮の乾燥対策は？",
                "マッサージの正しいやり方は？"
            ],
            "30s": [
                "頭皮環境を整えるには？",
                "頭皮トラブル、何から改善すべき？",
                "頭皮マッサージは毎日すべき？"
            ],
            "40s+": [
                "年齢による頭皮の変化、ケア方法は？",
                "頭皮の健康を保つ習慣は？",
                "頭皮ケアに効果的な製品は？"
            ]
        }
    },
    "stress": {
        "male": {
            "20s": [
                "仕事のストレスで抜け毛が増えた",
                "ストレス性の薄毛は治る？",
                "円形脱毛症になった、どうすれば？"
            ],
            "30s": [
                "30代、仕事のプレッシャーで髪が抜ける",
                "ストレスと男性ホルモンの関係は？",
                "ストレス軽減で抜け毛は減る？"
            ],
            "40s+": [
                "40代のストレス性脱毛、回復する？",
                "ストレス管理と育毛の両立方法は？",
                "仕事の疲れが髪に影響している？"
            ]
        },
        "female": {
            "20s": [
                "ストレスで円形脱毛症になった",
                "仕事のプレッシャーで髪が薄くなる？",
                "ストレス性の抜け毛、どうケアする？"
            ],
            "30s": [
                "30代女性、仕事と家庭のストレスで抜け毛が",
                "ストレスによる女性ホルモンの乱れが心配",
                "リラックス方法と育毛ケアの関係は？"
            ],
            "40s+": [
                "更年期のストレスと抜け毛の関係は？",
                "40代女性のストレス管理、髪への影響は？",
                "心の健康と髪の健康の関係を知りたい"
            ]
        },
        "all": {
            "20s": [
                "ストレス性の薄毛対策は？",
                "リラックス方法を教えて",
                "睡眠と髪の関係は？"
            ],
            "30s": [
                "ストレスで抜け毛が増えた、どうすれば？",
                "ストレス軽減に効果的な方法は？",
                "仕事のストレスと薄毛の関係は？"
            ],
            "40s+": [
                "年齢とストレス、髪への影響は？",
                "ストレス管理で髪は改善する？",
                "心と体のケアで育毛効果はある？"
            ]
        }
    },
    "postpartum": {
        "male": {
            "20s": [
                "パートナーの産後脱毛、どうサポートできる？",
                "妻の産後の髪の変化を理解したい",
                "産後ケア、夫ができることは？"
            ],
            "30s": [
                "妻の産後脱毛、夫としてできることは？",
                "産後の妻の髪の悩み、どう励ます？",
                "パートナーの産後ケアをサポートしたい"
            ],
            "40s+": [
                "妻の産後の変化を理解したい",
                "産後のパートナーをどう支える？",
                "家族として産後ケアをサポートする方法は？"
            ]
        },
        "female": {
            "20s": [
                "産後脱毛はいつ戻りますか？",
                "授乳中でもできるケアは？",
                "20代の産後ケア、栄養面のポイントは？"
            ],
            "30s": [
                "30代の産後脱毛、回復に時間がかかる？",
                "二人目出産後、一人目より抜け毛が多い理由は？",
                "育児ストレスと髪の関係は？"
            ],
            "40s+": [
                "40代の産後脱毛、ホルモンバランスは？",
                "高齢出産後の回復を早めるには？",
                "更年期と産後脱毛の重なりが心配"
            ]
        },
        "all": {
            "20s": [
                "産後脱毛の回復期間は？",
                "授乳期のヘアケアで気をつけることは？",
                "産後の栄養補給、髪に良い食べ物は？"
            ],
            "30s": [
                "30代の産後脱毛、いつまで続く？",
                "産後の抜け毛対策、何ができる？",
                "育児中でもできる簡単ヘアケアは？"
            ],
            "40s+": [
                "40代の産後脱毛、特別なケアは必要？",
                "産後の髪の回復、年齢の影響は？",
                "高齢出産後のヘアケアのポイントは？"
            ]
        }
    },
    "prevention": {
        "male": {
            "20s": [
                "AGAになる前にできる予防法は？",
                "親がハゲているので早めに対策したい",
                "20代から始める薄毛予防は何？"
            ],
            "30s": [
                "30代からの薄毛予防、遅くない？",
                "今は大丈夫だけど将来が心配",
                "予防的な育毛ケア、何をすべき？"
            ],
            "40s+": [
                "40代から始める予防ケアは効果ある？",
                "年齢に応じた予防方法を知りたい",
                "これ以上薄くならないための対策は？"
            ]
        },
        "female": {
            "20s": [
                "母が薄毛なので予防したい",
                "20代からできる薄毛予防は？",
                "将来のために今できることは？"
            ],
            "30s": [
                "30代女性の薄毛予防、何が大事？",
                "出産前後の予防ケアは？",
                "女性ホルモンを保つ生活習慣は？"
            ],
            "40s+": [
                "更年期に備えた予防ケアは？",
                "40代からの薄毛予防、効果的な方法は？",
                "年齢による髪の変化を遅らせるには？"
            ]
        },
        "all": {
            "20s": [
                "今からできる予防法は？",
                "生活習慣で気をつけることは？",
                "頭皮環境を整えるには？"
            ],
            "30s": [
                "30代から始める薄毛予防は？",
                "予防的ヘアケア、何を重視すべき？",
                "将来のために今できることは？"
            ],
            "40s+": [
                "40代からの予防ケア、遅くない？",
                "年齢に応じた予防方法を知りたい",
                "これ以上進行させないための対策は？"
            ]
        }
    }
}


def _calculate_age_group(birth_date: str | None) -> str:
    """
    生年月日から年齢グループを計算

    Args:
        birth_date: "YYYY-MM-DD" 形式の生年月日

    Returns:
        "20s", "30s", "40s+", または "unknown"
    """
    if not birth_date:
        return "unknown"

    try:
        birth = datetime.strptime(birth_date, "%Y-%m-%d").date()
        today = datetime.now(ZoneInfo("Asia/Tokyo")).date()
        age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))

        if age < 30:
            return "20s"
        elif age < 40:
            return "30s"
        else:
            return "40s+"
    except (ValueError, AttributeError):
        return "unknown"


def _normalize_gender(gender: str | None) -> str:
    """
    性別値を質問ルックアップ用に正規化

    Args:
        gender: "male", "female", "prefer-not-to-say", None等

    Returns:
        "male", "female", または "all"
    """
    if gender in ["male", "female"]:
        return gender
    return "all"  # prefer-not-to-say, None, 不正値は全て"all"扱い


def _select_question_for_concern(
    concern: str,
    gender: str,
    age_group: str
) -> str | None:
    """
    特定のconcernに対して1つの質問を選択（フォールバックチェーン付き）

    フォールバック順序:
    1. concern → gender → age_group
    2. concern → "all" → age_group
    3. concern → gender → "unknown"
    4. concern → "all" → "unknown"
    5. CONCERN_QUESTIONS[concern] (レガシー互換)
    6. FALLBACK_QUESTIONS

    Args:
        concern: お悩みカテゴリ（"thinning", "hairline"等）
        gender: 正規化済み性別（"male", "female", "all"）
        age_group: 年齢グループ（"20s", "30s", "40s+", "unknown"）

    Returns:
        選択された質問文字列、または None
    """
    concern_data = PERSONALIZED_QUESTIONS.get(concern)
    if not concern_data:
        # 後方互換性: レガシーマッピングを確認
        legacy_questions = CONCERN_QUESTIONS.get(concern)
        if legacy_questions:
            return random.choice(legacy_questions)
        return random.choice(FALLBACK_QUESTIONS)

    # 性別特化 + 年齢グループ
    if gender in concern_data:
        gender_data = concern_data[gender]
        if age_group in gender_data and gender_data[age_group]:
            return random.choice(gender_data[age_group])
        if "unknown" in gender_data and gender_data["unknown"]:
            return random.choice(gender_data["unknown"])

    # 性別中立 + 年齢グループ
    if "all" in concern_data:
        all_data = concern_data["all"]
        if age_group in all_data and all_data[age_group]:
            return random.choice(all_data[age_group])
        if "unknown" in all_data and all_data["unknown"]:
            return random.choice(all_data["unknown"])

    # 最終フォールバック
    return random.choice(FALLBACK_QUESTIONS)


def _get_personalized_questions(
    concern_areas: list[str],
    gender: str | None,
    birth_date: str | None
) -> tuple[list[str], str]:
    """
    concern + gender + ageに基づいて3つの質問を選択

    Args:
        concern_areas: お悩みカテゴリのリスト
        gender: 性別（"male", "female", "prefer-not-to-say", None等）
        birth_date: 生年月日（"YYYY-MM-DD"形式）

    Returns:
        (questions: list[str], source: str)
        source = "personalized" | "fallback"
    """
    normalized_gender = _normalize_gender(gender)
    age_group = _calculate_age_group(birth_date)

    # concernAreasのバリデーション
    if concern_areas:
        concern_areas = [c for c in concern_areas if isinstance(c, str)]

    if not concern_areas:
        return random.sample(FALLBACK_QUESTIONS, 3), "fallback"

    # 上位3つのconcernから各1問選択
    top_concerns = concern_areas[:3]
    questions = []

    for concern in top_concerns:
        question = _select_question_for_concern(concern, normalized_gender, age_group)
        if question:
            questions.append(question)

    # 3問に満たない場合はフォールバックで補完
    while len(questions) < 3:
        fallback = random.choice(FALLBACK_QUESTIONS)
        if fallback not in questions:
            questions.append(fallback)

    source = "personalized" if len(questions) > 0 else "fallback"
    return questions[:3], source


def _get_quick_qa_questions(concern_areas: list[str]) -> list[str]:
    """concernAreasに基づいて3つの質問を選択"""
    # 型チェック: 文字列のみをフィルタリング（異常値を除外）
    if concern_areas:
        concern_areas = [c for c in concern_areas if isinstance(c, str)]

    if not concern_areas:
        return random.sample(FALLBACK_QUESTIONS, 3)

    # 上位3つのconcern（または全て、3未満の場合）
    top_concerns = concern_areas[:3]

    questions = []
    for concern in top_concerns:
        concern_qs = CONCERN_QUESTIONS.get(concern, FALLBACK_QUESTIONS)
        # 各concernから1つランダムに選択
        questions.append(random.choice(concern_qs))

    # 3つに満たない場合はフォールバックで補完
    while len(questions) < 3:
        fallback = random.choice(FALLBACK_QUESTIONS)
        if fallback not in questions:
            questions.append(fallback)

    return questions[:3]


@router.get("/quick-qa", response_model=QuickQAResponse)
@limiter.limit("30/minute")
async def quick_qa(request: Request, uid: str = Depends(get_current_uid)) -> QuickQAResponse:
    """
    ユーザーのconcernAreas、gender、birthDateに基づいて3つの質問を推奨

    - Profile の concernAreas, gender, birthDate を読み取り
    - 性別・年齢グループを考慮してパーソナライズされた質問を選択
    - Firestoreにキャッシュ（TTL: 翌日4:00AM JST）
    """
    db = get_firestore_client()
    now = datetime.now(ZoneInfo("Asia/Tokyo"))

    # 1. キャッシュチェック
    try:
        qa_ref = db.collection("users").document(uid).collection("quickQA").document("latest")
        qa_doc = qa_ref.get()

        if qa_doc.exists:
            cached_data = qa_doc.to_dict()
            ttl = cached_data.get("ttl")
            if ttl:
                # timezone-awareの場合はastimezone、naiveの場合はreplaceを使用
                ttl_utc = ttl.astimezone(ZoneInfo("UTC")) if ttl.tzinfo else ttl.replace(tzinfo=ZoneInfo("UTC"))
                if ttl_utc > datetime.now(ZoneInfo("UTC")):
                    logging.info(f"Using cached quick Q&A for {uid}")
                    return QuickQAResponse(
                        questions=cached_data.get("questions", FALLBACK_QUESTIONS[:3]),
                        source=cached_data.get("source", "fallback"),
                        generatedAt=cached_data.get("generatedAt", now.isoformat())
                    )
    except Exception as e:
        logging.warning(f"Failed to fetch cached quick Q&A: {e}")

    # 2. Profileから concernAreas, gender, birthDate 取得
    concern_areas = []
    gender = None
    birth_date = None
    try:
        profile_ref = db.collection("users").document(uid).collection("profile").document("default")
        profile_doc = profile_ref.get()
        if profile_doc.exists:
            profile_data = profile_doc.to_dict()
            concern_areas = profile_data.get("concernAreas", [])
            gender = profile_data.get("gender")
            birth_date = profile_data.get("birthDate")
    except Exception as e:
        logging.warning(f"Failed to fetch profile data: {e}")

    # 3. パーソナライズされた質問生成
    questions, source = _get_personalized_questions(concern_areas, gender, birth_date)

    # 4. キャッシュ保存（TTL: 翌日4:00AM JST）
    try:
        tomorrow = now.date() + timedelta(days=1)
        ttl_time = datetime.combine(tomorrow, time(4, 0), tzinfo=ZoneInfo("Asia/Tokyo"))

        qa_ref.set({
            "questions": questions,
            "source": source,
            "generatedAt": now.isoformat(),
            "ttl": ttl_time,
            # デバッグ用メタデータ
            "gender": gender,
            "ageGroup": _calculate_age_group(birth_date),
            "concernCount": len(concern_areas)
        })
        logging.info(f"Cached personalized quick Q&A for {uid} (gender={gender}, age={_calculate_age_group(birth_date)}), TTL: {ttl_time.isoformat()}")
    except Exception as e:
        logging.error(f"Failed to cache quick Q&A: {e}", exc_info=True)

    return QuickQAResponse(
        questions=questions,
        source=source,
        generatedAt=now.isoformat()
    )


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


def _assert_meal_path(uid: str, storage_path: str) -> None:
    """
    Validate that the storage path is owned by the user and is for meal images.

    Args:
        uid: The user ID
        storage_path: The storage path to validate

    Raises:
        HTTPException: If the path is invalid or not owned by the user
    """
    # Basic validation (path traversal, extension, etc.)
    validate_storage_path(storage_path)

    # Owner validation: must be under users/{uid}/meals/
    if not storage_path.startswith(f"users/{uid}/meals/"):
        raise HTTPException(status_code=403, detail="Invalid storage path: must be under users/{uid}/meals/")


def _download_image_from_storage(storage_path: str) -> bytes:
    """
    Firebase Storage から画像バイトをダウンロードする。

    DEPRECATED: Use download_image_bytes from storage module instead.
    This function is kept for backward compatibility but should not be used for user input.
    """
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
        # Owner validation: ensure the path belongs to the user
        _assert_meal_path(uid, req.storagePath)
        # Download image using the secure storage module
        image_bytes = download_image_bytes(req.storagePath)
    except HTTPException:
        # Re-raise HTTPException as-is (403 Forbidden for invalid ownership)
        raise
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

class GenerateDailyRequest(BaseModel):
    planId: Optional[str] = None

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
    req: GenerateDailyRequest,
    uid: str = Depends(get_current_uid),
) -> PlanResponse:
    """今日のアクションを手動で生成する（週次プラン未作成時は自動作成）"""
    db = get_firestore_client()

    # 1. planId が指定されていない場合、アクティブな週次プランを検索または作成
    if not req.planId:
        plans_ref = db.collection("users").document(uid).collection("plans")
        active_plans = plans_ref.where("status", "==", "active").stream()

        active_plan_doc = None
        now = datetime.now(ZoneInfo("Asia/Tokyo"))

        for plan_doc in active_plans:
            plan_data = plan_doc.to_dict()
            # 期限内チェック
            end_date = plan_data.get("endDate")
            if end_date:
                if isinstance(end_date, str):
                    try:
                        end_date = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                    except Exception:
                        continue
                if now <= end_date:
                    active_plan_doc = plan_doc
                    break

        # 2. アクティブなプランがなければ、新規作成
        if not active_plan_doc:
            # 傾向スコアを取得
            doc_ref = db.collection("users").document(uid).collection("tendencyScores").document("latest")
            doc = doc_ref.get()

            if not doc.exists:
                raise HTTPException(status_code=404, detail="No tendency data found")

            data = doc.to_dict()
            scores = {
                "hormone": data.get("hormonal", 0),
                "blood_flow": data.get("bloodCirculation", 0),
                "circadian": data.get("circadian", 0),
                "stress": data.get("stress", 0),
            }
            answers = data.get("answers", {})

            # 古いアクティブプランを completed に変更
            old_active_plans = plans_ref.where("status", "==", "active").stream()
            for old_plan in old_active_plans:
                plans_ref.document(old_plan.id).update({"status": "completed"})

            # 新規プラン作成
            plan = generate_weekly_plan(scores, answers)
            plan_id = plan["planId"]

            # Firestoreに保存
            plan_ref = plans_ref.document(plan_id)
            plan_ref.set({
                "planId": plan_id,
                "startDate": plan["startDate"],
                "endDate": plan["endDate"],
                "theme": plan["theme"],
                "status": "active",
                "createdAt": now.isoformat(),
                "createdScores": plan["createdScores"]
            })

            req.planId = plan_id
            logging.info(f"Auto-created weekly plan {plan_id} for user {uid}")
        else:
            req.planId = active_plan_doc.id

    # 3. Get plan by ID (skip status check to support expired plans)
    plan_ref = db.collection("users").document(uid).collection("plans").document(req.planId)
    plan_doc = plan_ref.get()

    if not plan_doc.exists:
         raise HTTPException(status_code=404, detail="Plan not found")

    plan_data = plan_doc.to_dict()

    # Log warning if plan is expired
    now = datetime.now(ZoneInfo("Asia/Tokyo"))
    end_date_str = plan_data.get("endDate")
    if end_date_str:
        try:
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
            if now > end_date:
                logging.warning(f"Generating actions for expired plan {req.planId}")
        except Exception:
            pass  # Ignore invalid date format

    # 4. Fetch tendency for context
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

    # 5. Generate Actions
    # Use history to avoid duplicates? (Feature for later)
    actions = generate_daily_actions(scores, answers)

    # 6. Determine Target Date (Today vs Tomorrow)
    now = datetime.now(ZoneInfo("Asia/Tokyo"))
    today_str = now.strftime("%Y-%m-%d")
    if now.hour < 4:
         today_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")

    # Check if today is already confirmed
    log_doc = plan_ref.collection("logs").document(today_str).get()
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

    # 7. Save Actions
    plan_ref.collection("dailyActions").document(target_date_str).set({
        "actions": actions,
        "createdAt": now.isoformat()
    })

    # 8. Return Response
    # Fetch log for the target view date
    view_log_doc = plan_ref.collection("logs").document(target_date_str).get()
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
    print(f"[/plan/current] Starting for user {uid}")  # Use print for debugging
    logging.warning(f"[/plan/current] Starting for user {uid}")
    db = get_firestore_client()

    # 1. Find latest plan (prioritize active, then completed)
    plans_ref = db.collection("users").document(uid).collection("plans")
    print(f"[/plan/current] Fetching plans for user {uid}")
    logging.warning(f"[/plan/current] Fetching plans for user {uid}")

    # Try to get all plans and sort in Python (more reliable than Firestore ordering)
    try:
        all_docs = list(plans_ref.stream())
        print(f"[/plan/current] Retrieved {len(all_docs) if all_docs else 0} plans")
        logging.warning(f"[/plan/current] Retrieved {len(all_docs) if all_docs else 0} plans")
    except Exception as e:
        print(f"[/plan/current] Error fetching plans: {e}")
        logging.error(f"[/plan/current] Error fetching plans: {e}", exc_info=True)
        return PlanResponse(planId=None, theme=None, startDate=None, endDate=None)

    if not all_docs:
        print(f"[/plan/current] No plan found for user {uid}")
        logging.warning(f"[/plan/current] No plan found for user {uid}")
        return PlanResponse(planId=None, theme=None, startDate=None, endDate=None)

    # Sort by status priority (active first) and then by creation time
    def get_plan_priority(doc):
        try:
            data = doc.to_dict()
            status = data.get("status", "")
            created_at = data.get("createdAt", "")
            # Active plans get priority 0, completed/expired get priority 1
            status_priority = 0 if status == "active" else 1
            return (status_priority, created_at)
        except Exception as e:
            logging.error(f"[/plan/current] Error in get_plan_priority: {e}")
            return (1, "")  # Default priority

    # Sort and get the first one (active plans first with reverse=False)
    try:
        sorted_docs = sorted(all_docs, key=get_plan_priority, reverse=False)
        plan_doc = sorted_docs[0]
        plan_data = plan_doc.to_dict()
        logging.info(f"[/plan/current] Found plan {plan_doc.id} with status {plan_data.get('status')}, total plans: {len(all_docs)}")
    except Exception as e:
        logging.error(f"[/plan/current] Error sorting/accessing plans: {e}", exc_info=True)
        return PlanResponse(planId=None, theme=None, startDate=None, endDate=None)
    
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

    # 3. Determine view date (Always show today's missions, even if confirmed)
    current_date_obj = now
    if now.hour < 4:
        current_date_obj = now - timedelta(days=1)

    today_str = current_date_obj.strftime("%Y-%m-%d")

    # Check today's confirmation
    today_log_doc = plan_doc.reference.collection("logs").document(today_str).get()
    is_today_confirmed = False
    if today_log_doc.exists:
        is_today_confirmed = today_log_doc.to_dict().get("isConfirmed", False)

    # Always use today's date for view_date (don't advance to tomorrow)
    view_date_obj = current_date_obj
    view_date_str = view_date_obj.strftime("%Y-%m-%d")

    logging.info(f"[/plan/current] view_date={view_date_str}, is_today_confirmed={is_today_confirmed}")

    # 4. Fetch Actions for view date (auto-generate if missing)
    daily_actions_doc = plan_doc.reference.collection("dailyActions").document(view_date_str).get()
    view_actions = []
    if daily_actions_doc.exists:
        view_actions = daily_actions_doc.to_dict().get("actions", [])
        logging.info(f"[/plan/current] Found existing daily actions for {view_date_str}, count: {len(view_actions)}")
    else:
        # Auto-generate daily actions ONLY if missing for this date
        logging.warning(f"[/plan/current] Daily actions missing for {view_date_str}, will auto-generate")
        try:
            # Get scores from plan
            scores = plan_data.get("createdScores", {
                "hormone": 50,
                "blood_flow": 50,
                "circadian": 50,
                "stress": 50
            })

            # Get answers from latest tendency
            tendency_doc = db.collection("users").document(uid).collection("tendencyScores").document("latest").get()
            answers = {}
            if tendency_doc.exists:
                answers = tendency_doc.to_dict().get("answers", {})

            # Generate actions
            actions = generate_daily_actions(scores, answers)

            # Save to Firestore (only if still doesn't exist - prevent race condition)
            plan_doc.reference.collection("dailyActions").document(view_date_str).set({
                "actions": actions,
                "createdAt": now.isoformat()
            })

            view_actions = actions
            logging.warning(f"[/plan/current] Auto-generated {len(actions)} daily actions for {view_date_str}")
        except Exception as e:
            logging.error(f"[/plan/current] Failed to auto-generate daily actions: {e}", exc_info=True)
            view_actions = []
    
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


# ---------------------------------------------------------------------------
# POST /cleanup-user-data — ユーザーデータクリーンアップ（退会時）
# ---------------------------------------------------------------------------

def _batch_delete_collection(db, collection_ref, batch_size: int = 500) -> int:
    """
    Delete all documents in a collection using batch writes for better performance.

    Args:
        db: Firestore client
        collection_ref: Collection reference to delete
        batch_size: Number of documents to delete per batch (max 500 for Firestore)

    Returns:
        Number of documents deleted
    """
    docs = list(collection_ref.stream())
    if not docs:
        return 0

    deleted_count = 0
    batch = db.batch()
    batch_count = 0

    for doc in docs:
        batch.delete(doc.reference)
        batch_count += 1
        deleted_count += 1

        # Commit batch when reaching limit
        if batch_count >= batch_size:
            batch.commit()
            batch = db.batch()
            batch_count = 0

    # Commit remaining batch
    if batch_count > 0:
        batch.commit()

    return deleted_count


@router.post("/cleanup-user-data")
@limiter.limit("5/minute")
async def cleanup_user_data(
    request: Request,
    uid: str = Depends(get_current_uid)
):
    """
    Delete read-only collections that cannot be deleted from client (firestore.rules).
    Called during user account deletion to ensure complete data removal.

    Deletes:
    - dailyMissions: Generated missions (allow write: if false)
    - chatTasks: Chat-related tasks (allow write: if false)
    - quickActions: Quick action cache
    - quickQA: Quick Q&A cache
    - motivationMessages: Motivation message cache
    - mealAnalysis: Meal analysis cache
    - chatSettings: Chat settings
    - foodRequests/{uid}/items: Food recommendation items (top-level collection)
    - foodRequests/{uid}/recipes: Food recommendation recipes (top-level collection)
    - reports/{uid}/items: Weekly reports (top-level collection)

    Returns:
        Dict with deletion summary
    """
    db = get_firestore_client()
    deleted_collections = []
    errors = []

    # Delete dailyMissions collection (using batch delete for better performance)
    try:
        missions_ref = db.collection("users").document(uid).collection("dailyMissions")
        deleted_count = _batch_delete_collection(db, missions_ref)

        if deleted_count > 0:
            deleted_collections.append(f"dailyMissions ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} dailyMissions documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete dailyMissions for user {uid}: {e}", exc_info=True)
        errors.append(f"dailyMissions: {str(e)}")

    # Delete chatTasks collection (using batch delete for better performance)
    try:
        tasks_ref = db.collection("users").document(uid).collection("chatTasks")
        deleted_count = _batch_delete_collection(db, tasks_ref)

        if deleted_count > 0:
            deleted_collections.append(f"chatTasks ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} chatTasks documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete chatTasks for user {uid}: {e}", exc_info=True)
        errors.append(f"chatTasks: {str(e)}")

    # Delete quickActions collection (using batch delete for better performance)
    try:
        quick_actions_ref = db.collection("users").document(uid).collection("quickActions")
        deleted_count = _batch_delete_collection(db, quick_actions_ref)

        if deleted_count > 0:
            deleted_collections.append(f"quickActions ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} quickActions documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete quickActions for user {uid}: {e}", exc_info=True)
        errors.append(f"quickActions: {str(e)}")

    # Delete quickQA collection (using batch delete for better performance)
    try:
        quick_qa_ref = db.collection("users").document(uid).collection("quickQA")
        deleted_count = _batch_delete_collection(db, quick_qa_ref)

        if deleted_count > 0:
            deleted_collections.append(f"quickQA ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} quickQA documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete quickQA for user {uid}: {e}", exc_info=True)
        errors.append(f"quickQA: {str(e)}")

    # Delete motivationMessages collection (using batch delete for better performance)
    try:
        motivation_ref = db.collection("users").document(uid).collection("motivationMessages")
        deleted_count = _batch_delete_collection(db, motivation_ref)

        if deleted_count > 0:
            deleted_collections.append(f"motivationMessages ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} motivationMessages documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete motivationMessages for user {uid}: {e}", exc_info=True)
        errors.append(f"motivationMessages: {str(e)}")

    # Delete mealAnalysis collection (using batch delete for better performance)
    try:
        meal_ref = db.collection("users").document(uid).collection("mealAnalysis")
        deleted_count = _batch_delete_collection(db, meal_ref)

        if deleted_count > 0:
            deleted_collections.append(f"mealAnalysis ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} mealAnalysis documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete mealAnalysis for user {uid}: {e}", exc_info=True)
        errors.append(f"mealAnalysis: {str(e)}")

    # Delete chatSettings collection (using batch delete for better performance)
    try:
        settings_ref = db.collection("users").document(uid).collection("chatSettings")
        deleted_count = _batch_delete_collection(db, settings_ref)

        if deleted_count > 0:
            deleted_collections.append(f"chatSettings ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} chatSettings documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete chatSettings for user {uid}: {e}", exc_info=True)
        errors.append(f"chatSettings: {str(e)}")

    # Delete food recommendations from new location: users/{uid}/foodRecommendations (current standard)
    # Using batch delete for better performance
    try:
        new_food_recs_ref = db.collection("users").document(uid).collection("foodRecommendations")
        deleted_count = _batch_delete_collection(db, new_food_recs_ref)

        if deleted_count > 0:
            deleted_collections.append(f"users/{uid}/foodRecommendations ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} users/{uid}/foodRecommendations documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete users/{uid}/foodRecommendations for user {uid}: {e}", exc_info=True)
        errors.append(f"users/{uid}/foodRecommendations: {str(e)}")

    # Delete food recommendations from old location: foodRequests/{uid}/items (legacy, for backward compatibility)
    # Using batch delete for better performance
    try:
        old_food_items_ref = db.collection("foodRequests").document(uid).collection("items")
        deleted_count = _batch_delete_collection(db, old_food_items_ref)

        if deleted_count > 0:
            deleted_collections.append(f"foodRequests/{uid}/items (legacy) ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} foodRequests/{uid}/items (legacy) documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete foodRequests/{uid}/items (legacy) for user {uid}: {e}", exc_info=True)
        errors.append(f"foodRequests/{uid}/items (legacy): {str(e)}")

    # Delete food recipes from new location: users/{uid}/foodRecipes (current standard)
    # Using batch delete for better performance
    try:
        new_food_recipes_ref = db.collection("users").document(uid).collection("foodRecipes")
        deleted_count = _batch_delete_collection(db, new_food_recipes_ref)

        if deleted_count > 0:
            deleted_collections.append(f"users/{uid}/foodRecipes ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} users/{uid}/foodRecipes documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete users/{uid}/foodRecipes for user {uid}: {e}", exc_info=True)
        errors.append(f"users/{uid}/foodRecipes: {str(e)}")

    # Delete food recipes from old location: foodRequests/{uid}/recipes (legacy, for backward compatibility)
    # Using batch delete for better performance
    try:
        old_food_recipes_ref = db.collection("foodRequests").document(uid).collection("recipes")
        deleted_count = _batch_delete_collection(db, old_food_recipes_ref)

        if deleted_count > 0:
            deleted_collections.append(f"foodRequests/{uid}/recipes (legacy) ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} foodRequests/{uid}/recipes (legacy) documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete foodRequests/{uid}/recipes (legacy) for user {uid}: {e}", exc_info=True)
        errors.append(f"foodRequests/{uid}/recipes (legacy): {str(e)}")

    # Delete reports from new location: users/{uid}/reports (current standard)
    # Using batch delete for better performance
    try:
        new_reports_ref = db.collection("users").document(uid).collection("reports")
        deleted_count = _batch_delete_collection(db, new_reports_ref)

        if deleted_count > 0:
            deleted_collections.append(f"users/{uid}/reports ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} users/{uid}/reports documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete users/{uid}/reports for user {uid}: {e}", exc_info=True)
        errors.append(f"users/{uid}/reports: {str(e)}")

    # Delete reports from old location: reports/{uid}/items (legacy, for backward compatibility)
    # Using batch delete for better performance
    try:
        old_reports_ref = db.collection("reports").document(uid).collection("items")
        deleted_count = _batch_delete_collection(db, old_reports_ref)

        if deleted_count > 0:
            deleted_collections.append(f"reports/{uid}/items (legacy) ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} reports/{uid}/items (legacy) documents for user {uid}")

        # Delete parent document reports/{uid} (GDPR compliance)
        db.collection("reports").document(uid).delete()
        deleted_collections.append(f"reports/{uid} (parent doc)")
        logging.info(f"Deleted parent document reports/{uid}")
    except Exception as e:
        logging.error(f"Failed to delete reports/{uid}/items (legacy) for user {uid}: {e}", exc_info=True)
        errors.append(f"reports/{uid}/items (legacy): {str(e)}")

    # Delete parent document foodRequests/{uid} (GDPR compliance)
    try:
        db.collection("foodRequests").document(uid).delete()
        deleted_collections.append(f"foodRequests/{uid} (parent doc)")
        logging.info(f"Deleted parent document foodRequests/{uid}")
    except Exception as e:
        logging.error(f"Failed to delete foodRequests/{uid} parent document: {e}", exc_info=True)
        errors.append(f"foodRequests/{uid} (parent doc): {str(e)}")

    # Return summary
    return {
        "status": "completed",
        "deleted": deleted_collections,
        "errors": errors if errors else None,
        "timestamp": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat()
    }
