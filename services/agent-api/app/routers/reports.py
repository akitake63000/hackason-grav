from datetime import datetime, timedelta, timezone
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends
from firebase_admin import firestore as admin_firestore
from pydantic import BaseModel

from ..auth import get_current_uid
from ..firebase import get_firestore_client
from ..config import GEMINI_MODEL_HEAVY
from ..services.gemini_chat import GEMINI_MODEL, gemini_enabled, generate_text, safe_json_load

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
    series: list[tuple[datetime, float]], period_days: int
) -> Optional[ReportGenerateResponse]:
    model = GEMINI_MODEL_HEAVY or GEMINI_MODEL
    if not gemini_enabled(model):
        return None

    payload = [
        {"date": dt.date().isoformat(), "densityIndex": value}
        for dt, value in series
    ]

    prompt = (
        "あなたは薄毛対策の習慣化エージェントです。"
        "以下のJSONデータを基に、短い週次レポートを日本語で作成してください。"
        "医療診断はしないでください。一般的な生活改善の範囲にとどめてください。\n"
        "出力は必ず次のJSON形式のみ:\n"
        "{\n"
        '  "highlights": ["..."],\n'
        '  "nextActions": ["..."],\n'
        '  "rawText": "..." \n'
        "}\n"
        "highlightsは2〜3件、nextActionsは2〜3件、rawTextは要約文。\n"
        f"入力: {{\"periodDays\": {period_days}, \"series\": {payload}}}\n"
    )

    try:
        text = generate_text(prompt, model=model)
        data = safe_json_load(text)
    except Exception:  # noqa: BLE001
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
    analysis_ref = db.collection("analysisResults").document(uid).collection("items")
    docs = (
        analysis_ref.order_by(
            "computedAt", direction=admin_firestore.Query.DESCENDING
        )
        .limit(50)
        .get()
    )

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=period_days)
    series = []
    for doc in docs:
        data = doc.to_dict()
        ts = data.get("computedAt") or data.get("createdAt")
        computed_at = _to_datetime(ts)
        if not computed_at:
            continue
        if computed_at.tzinfo is None:
            computed_at = computed_at.replace(tzinfo=timezone.utc)
        if computed_at < cutoff:
            continue
        density = data.get("densityIndex")
        if isinstance(density, (int, float)):
            series.append((computed_at, float(density)))

    series.sort(key=lambda item: item[0])

    highlights: List[str] = []
    next_actions: List[str] = []
    raw_text = ""
    model_label = "rule_based_v1"

    llm_report = _generate_report_with_llm(series, period_days)
    if llm_report:
        highlights = llm_report.highlights
        next_actions = llm_report.nextActions
        raw_text = llm_report.rawText
        model_label = f"gemini:{GEMINI_MODEL_HEAVY or GEMINI_MODEL}"
    else:
        if not series:
            highlights.append("期間内の測定データがありません。")
            next_actions.append("週1回の写真チェックインを続けましょう。")
            next_actions.append("撮影条件（光・角度・距離）を揃えましょう。")
        else:
            first = series[0][1]
            latest = series[-1][1]
            delta = latest - first
            highlights.append(
                f"{period_days}日で密度指数は {latest:.3f}（変化 {delta:+.3f}）でした。"
            )
            if delta < 0:
                highlights.append(
                    "一時的なブレの可能性があるため、撮影条件を再確認してください。"
                )
            else:
                highlights.append("安定して推移しているため、継続できています。")

            next_actions.append("次回も同じ条件で撮影して比較精度を上げる。")
            next_actions.append("睡眠時間を確保し、タンパク質を意識する。")

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
