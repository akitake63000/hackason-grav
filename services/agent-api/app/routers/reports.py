from datetime import datetime, timedelta, timezone
from typing import List, Optional
import uuid
import logging
import json

from fastapi import APIRouter, Depends
from firebase_admin import firestore as admin_firestore
from pydantic import BaseModel

from ..auth import get_current_uid
from ..firebase import get_firestore_client
from ..config import GEMINI_MODEL_HEAVY
from ..services.gemini_chat import GEMINI_MODEL, gemini_enabled, generate_text, safe_json_load

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


class ReportGenerateRequest(BaseModel):
    periodDays: Optional[int] = 7


class ReportGenerateResponse(BaseModel):
    reportId: str
    highlights: List[str]
    nextActions: List[str]
    rawText: str


def _to_datetime(value) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if hasattr(value, "to_datetime"):
        return value.to_datetime()
    return None


def _generate_report_with_llm(
    series_data: list[dict], period_days: int
) -> Optional[ReportGenerateResponse]:
    model = GEMINI_MODEL_HEAVY or GEMINI_MODEL
    if not gemini_enabled(model):
        return None

    # payload is now a list of dicts with full info
    payload = series_data

    prompt = (
        "あなたは薄毛対策の習慣化エージェントです。"
        "以下のJSONデータ（過去の頭皮解析記録）を基に、ユーザーに向けた週次レポートを日本語で作成してください。"
        "データに含まれる「髪密度(score)」「薄毛タイプ(hairType/pattern)」「頭皮状態(scalpCondition)」の傾向を踏まえて、"
        "**具体的かつパーソナライズされた**アドバイスを行ってください。"
        "医療診断は断定せず、あくまで生活習慣やケアの改善提案として記述してください。\n"
        "入力データ詳細:\n"
        "- score: 0-100の髪密度スコア\n"
        "- pattern: M字, O字などの進行パターン\n"
        "- scalpCondition: 乾燥, 脂性などの頭皮状態\n"
        "\n"
        "出力は必ず次のJSON形式のみ:\n"
        "{\n"
        '  "highlights": ["..."],\n'
        '  "nextActions": ["..."],\n'
        '  "rawText": "..." \n'
        "}\n"
        "highlightsは2〜3件（数値の変化や特徴的な状態への言及）、nextActionsは2〜3件（タイプや状態に合わせた具体的な行動）、rawTextは全体のまとめ。\n"
        f"入力: {{\"periodDays\": {period_days}, \"history\": {payload}}}\n"
    )

    try:
        text = generate_text(prompt, model=model)
        data = safe_json_load(text)
    except (ValueError, json.JSONDecodeError, RuntimeError) as e:
        logger.warning(f"Failed to generate report with LLM: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in report generation: {e}", exc_info=True)
        return None

    highlights = data.get("highlights") or []
    next_actions = data.get("nextActions") or []
    raw_text = data.get("rawText") or ""

    if not isinstance(highlights, list) or not isinstance(next_actions, list):
        return None

    return ReportGenerateResponse(
        reportId="",
        highlights=[str(item) for item in highlights][:3],
        nextActions=[str(item) for item in next_actions][:3],
        rawText=str(raw_text),
    )


@router.post("/generate", response_model=ReportGenerateResponse)
def generate_report(
    payload: ReportGenerateRequest, uid: str = Depends(get_current_uid)
) -> ReportGenerateResponse:
    period_days = payload.periodDays or 7
    period_days = max(1, min(period_days, 30))

    db = get_firestore_client()
    analysis_ref = db.collection("reports").document(uid).collection("items") # CHECK: Should be analysisResults?
    # Correcting to fetch from analysisResults based on previous logic 
    analysis_ref = db.collection("users").document(uid).collection("analysisResults")

    docs = (
        analysis_ref.order_by(
            "analyzedAt", direction=admin_firestore.Query.DESCENDING
        )
        .limit(20) # Limit to 20 items to avoid token limit
        .get()
    )

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=period_days)
    series_data = [] # List of dicts for LLM
    series_for_calc = [] # List of (date, score) for calculation

    for doc in docs:
        data = doc.to_dict()
        ts = data.get("analyzedAt") or data.get("createdAt")
        computed_at = _to_datetime(ts)
        if not computed_at:
            continue
        if computed_at.tzinfo is None:
            computed_at = computed_at.replace(tzinfo=timezone.utc)
        if computed_at < cutoff:
            continue
        
        score = data.get("score")
        if isinstance(score, (int, float)):
            # Prepare data for LLM
            item_data = {
                "date": computed_at.date().isoformat(),
                "score": float(score),
                "hairType": data.get("hairType"),
                "pattern": data.get("pattern"),
                "scalpCondition": data.get("scalpCondition"),
                "notes": data.get("notes")
            }
            series_data.append(item_data)
            series_for_calc.append((computed_at, float(score)))

    series_data.sort(key=lambda item: item["date"])
    series_for_calc.sort(key=lambda item: item[0])

    highlights: List[str] = []
    next_actions: List[str] = []
    raw_text = ""
    model_label = "rule_based_v1"

    llm_report = _generate_report_with_llm(series_data, period_days)
    if llm_report:
        highlights = llm_report.highlights
        next_actions = llm_report.nextActions
        raw_text = llm_report.rawText
        model_label = f"gemini:{GEMINI_MODEL_HEAVY or GEMINI_MODEL}"
    else:
        if not series_for_calc:
            highlights.append("期間内の測定データがありません。")
            next_actions.append("写真チェックインを行い、あなたの髪質の記録を始めましょう。")
        else:
            first = series_for_calc[0][1]
            latest = series_for_calc[-1][1]
            delta = latest - first
            highlights.append(
                f"{period_days}日でスコアは {latest:.1f}（変化 {delta:+.1f}）でした。"
            )
            highlights.append("継続的な記録が精度の高いアドバイスにつながります。")
            
            # Simple fallback advice logic based on latest data if available
            latest_data = series_data[-1]
            condition = latest_data.get("scalpCondition")
            if condition == "乾燥":
                next_actions.append("頭皮が乾燥気味です。保湿ケアを心がけましょう。")
            elif condition == "脂性":
                next_actions.append("皮脂が多めです。丁寧なシャンプーを意識してください。")
            else:
                next_actions.append("バランスの良い食事と睡眠を心がけましょう。")

        raw_text = "\n".join(highlights + ["---"] + next_actions)

    report_id = f"report_{uuid.uuid4().hex}"

    db.collection("reports").document(uid).collection("items").document(report_id).set(
        {
            "createdAt": admin_firestore.SERVER_TIMESTAMP,
            "period": {
                "from": cutoff.date().isoformat(),
                "to": now.date().isoformat(),
                "days": period_days,
            },
            "highlights": highlights,
            "nextActions": next_actions,
            "rawText": raw_text,
            "llm": {"model": model_label},
        }
    )

    return ReportGenerateResponse(
        reportId=report_id,
        highlights=highlights,
        nextActions=next_actions,
        rawText=raw_text,
    )
