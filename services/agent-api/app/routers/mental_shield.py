import logging
import os
from typing import List, Optional, Tuple, TypedDict

from fastapi import APIRouter, Depends
from firebase_admin import firestore as admin_firestore
from pydantic import BaseModel

from ..auth import get_current_uid
from ..firebase import get_firestore_client
from ..services.gemini_chat import gemini_enabled, generate_text, safe_json_load

router = APIRouter(prefix="/api/v1/mental-shield", tags=["mental-shield"])


class MentalShieldRequest(BaseModel):
    threadId: Optional[str] = "default"
    message: str
    mode: Optional[str] = "balanced"


class MentalShieldCard(BaseModel):
    agent: str
    text: str


class MentalShieldResponse(BaseModel):
    cards: List[MentalShieldCard]
    summary: str
    threadId: str


def _contains_risk_keywords(message: str) -> bool:
    keywords = [
        "出血",
        "痛い",
        "強いかゆみ",
        "赤み",
        "炎症",
        "円形脱毛",
        "急に",
        "発熱",
        "膿",
        "ただれ",
    ]
    return any(key in message for key in keywords)


def _generate_mental_with_llm(
    message: str,
) -> Tuple[Optional[List[MentalShieldCard]], Optional[str]]:
    if not gemini_enabled():
        return None, None

    prompt = (
        "あなたは薄毛対策のメンタル支援エージェントです。"
        "以下の相談内容に対して、3人格（encourager/coach/doctor）の短い回答と"
        "まとめを日本語で返してください。診断はしないでください。\n"
        "出力は必ず次のJSON形式のみ:\n"
        "{\n"
        '  "cards": [\n'
        '    {"agent": "encourager", "text": "..."},\n'
        '    {"agent": "coach", "text": "..."},\n'
        '    {"agent": "doctor", "text": "..."}\n'
        "  ],\n"
        '  "summary": "..." \n'
        "}\n"
        f"相談内容: {message}\n"
    )

    try:
        text = generate_text(prompt)
        data = safe_json_load(text)
    except Exception:  # noqa: BLE001
        return None, None

    cards_data = data.get("cards")
    summary = data.get("summary")
    if not isinstance(cards_data, list) or not summary:
        return None, None

    cards: List[MentalShieldCard] = []
    for item in cards_data:
        agent = str(item.get("agent", ""))
        text_value = str(item.get("text", ""))
        if agent not in {"encourager", "coach", "doctor"} or not text_value:
            continue
        cards.append(MentalShieldCard(agent=agent, text=text_value))

    if len(cards) < 3:
        return None, None

    return cards, str(summary)


def _compose_mental_shield(message: str) -> Tuple[List[MentalShieldCard], str]:
    risk = _contains_risk_keywords(message)

    llm_cards, llm_summary = _generate_mental_with_llm(message)
    if llm_cards and llm_summary:
        return llm_cards, llm_summary

    encourager = (
        "不安に感じるのは自然な反応です。今ここで一緒に整理しましょう。"
        "継続できている点を思い出せていますか？"
    )
    coach = (
        "今日の最小の一手は「同条件で写真を撮る」か「睡眠を30分確保する」。"
        "1つだけやり切ろう。"
    )
    doctor = (
        "一般論として、抜け毛は睡眠・ストレス・栄養の影響を受けます。"
        "ただし診断はできません。"
    )

    if risk:
        doctor += " 皮膚の痛み・強い赤み・円形の脱毛などがある場合は受診も検討してください。"
    else:
        doctor += " 変化が急でなければ、同条件での経過観察が有効です。"

    cards = [
        MentalShieldCard(agent="encourager", text=encourager),
        MentalShieldCard(agent="coach", text=coach),
        MentalShieldCard(agent="doctor", text=doctor),
    ]
    summary = "今日の最小の一手: 「同条件の写真チェックイン」か「睡眠の確保」。"
    return cards, summary


@router.post("/chat", response_model=MentalShieldResponse)
def mental_shield_chat(
    payload: MentalShieldRequest, uid: str = Depends(get_current_uid)
) -> MentalShieldResponse:
    thread_id = payload.threadId or "default"
    cards, summary = _compose_mental_shield(payload.message)

    db = get_firestore_client()
    messages_ref = (
        db.collection("conversations")
        .document(uid)
        .collection("threads")
        .document(thread_id)
        .collection("messages")
    )

    messages_ref.add(
        {
            "role": "user",
            "agent": "user",
            "text": payload.message,
            "createdAt": admin_firestore.SERVER_TIMESTAMP,
        }
    )

    for card in cards:
        messages_ref.add(
            {
                "role": "agent",
                "agent": card.agent,
                "text": card.text,
                "createdAt": admin_firestore.SERVER_TIMESTAMP,
            }
        )

    messages_ref.add(
        {
            "role": "agent",
            "agent": "orchestrator",
            "text": summary,
            "createdAt": admin_firestore.SERVER_TIMESTAMP,
        }
    )

    return MentalShieldResponse(cards=cards, summary=summary, threadId=thread_id)


# ---------------------------------------------------------------------------
# /chat/discuss - LangGraph によるエージェント議論エンドポイント
# ---------------------------------------------------------------------------

logger = logging.getLogger(__name__)


class MentalShieldDiscussResponse(BaseModel):
    cards: List[MentalShieldCard]
    summary: str
    threadId: str
    bestAgent: str


class _DiscussState(TypedDict):
    user_message: str
    risk_detected: bool
    encourager_response: str
    coach_response: str
    doctor_response: str
    encourager_response_r2: str
    coach_response_r2: str
    doctor_response_r2: str
    best_agent: str
    summary: str


def _detect_risk_node(state: _DiscussState) -> dict:
    return {"risk_detected": _contains_risk_keywords(state["user_message"])}


def _encourager_node(state: _DiscussState) -> dict:
    prompt = (
        "あなたは薄毛対策メンタル支援チームの「サポーター（❤️）」です。\n"
        "温かく共感的に寄り添い、相談者が継続できるよう励ます役割です。\n"
        "以下の相談に対して、日本語で短く回答してください。\n\n"
        f"相談内容: {state['user_message']}\n"
    )
    try:
        text = generate_text(prompt)
    except Exception:
        text = (
            "不安に感じるのは自然な反応です。今ここで一緒に整理しましょう。"
            "継続できている点を思い出せていますか？"
        )
    return {"encourager_response": text}


def _coach_node(state: _DiscussState) -> dict:
    prompt = (
        "あなたは薄毛対策メンタル支援チームの「コーチ（💪）」です。\n"
        "具体的なアクションを1つだけ提案する役割です。\n\n"
        "チームメンバーのサポーターが以下の意見を出しています:\n"
        f"サポーターの意見: {state['encourager_response']}\n\n"
        "サポーターの意見を踏まえつつ、以下の相談に回答してください。\n"
        f"相談内容: {state['user_message']}\n"
    )
    try:
        text = generate_text(prompt)
    except Exception:
        text = (
            "今日の最小の一手は「同条件で写真を撮る」か「睡眠を30分確保する」。"
            "1つだけやり切ろう。"
        )
    return {"coach_response": text}


def _doctor_node(state: _DiscussState) -> dict:
    risk_note = ""
    if state.get("risk_detected"):
        risk_note = "※相談内容に医療リスクに関するキーワードが含まれています。必要に応じて受診を勧めてください。\n"

    prompt = (
        "あなたは薄毛対策メンタル支援チームの「ドクター（🔬）」です。\n"
        "医学的・科学的な情報を提供する役割です。診断はしないでください。\n\n"
        f"{risk_note}"
        "チームメンバーが以下の意見を出しています:\n"
        f"サポーターの意見: {state['encourager_response']}\n"
        f"コーチの意見: {state['coach_response']}\n\n"
        "2人の意見を踏まえつつ、以下の相談に回答してください。\n"
        f"相談内容: {state['user_message']}\n"
    )
    try:
        text = generate_text(prompt)
    except Exception:
        text = (
            "一般論として、抜け毛は睡眠・ストレス・栄養の影響を受けます。"
            "ただし診断はできません。変化が急でなければ、同条件での経過観察が有効です。"
        )
    return {"doctor_response": text}


def _encourager_node_r2(state: _DiscussState) -> dict:
    prompt = (
        "あなたは薄毛対策メンタル支援チームの「サポーター（❤️）」です。\n"
        "1回目の議論で3人がそれぞれ意見を出しました。\n"
        "それを踏まえて、改めて相談者へのアドバイスを短くまとめてください。\n\n"
        "【1回目の議論】\n"
        f"あなたの意見: {state['encourager_response']}\n"
        f"コーチの意見: {state['coach_response']}\n"
        f"ドクターの意見: {state['doctor_response']}\n\n"
        f"相談内容: {state['user_message']}\n"
    )
    try:
        text = generate_text(prompt)
    except Exception:
        text = (
            "皆さんの意見を聞いて、まず気持ちを整理することが大切だと改めて感じます。"
            "焦らず一歩ずつ進みましょう。"
        )
    return {"encourager_response_r2": text}


def _coach_node_r2(state: _DiscussState) -> dict:
    prompt = (
        "あなたは薄毛対策メンタル支援チームの「コーチ（💪）」です。\n"
        "1回目の議論とサポーターの2回目の発言を踏まえて、\n"
        "具体的なアクションを1つだけ提案してください。\n\n"
        "【1回目の議論】\n"
        f"サポーター: {state['encourager_response']}\n"
        f"あなたの意見: {state['coach_response']}\n"
        f"ドクター: {state['doctor_response']}\n\n"
        "【2回目】\n"
        f"サポーター: {state['encourager_response_r2']}\n\n"
        f"相談内容: {state['user_message']}\n"
    )
    try:
        text = generate_text(prompt)
    except Exception:
        text = (
            "議論を踏まえて、今日やるべきことは1つ。"
            "「同条件で写真を撮って記録する」これだけやりましょう。"
        )
    return {"coach_response_r2": text}


def _doctor_node_r2(state: _DiscussState) -> dict:
    risk_note = ""
    if state.get("risk_detected"):
        risk_note = "※医療リスクキーワードあり。必要に応じて受診を勧めてください。\n"

    prompt = (
        "あなたは薄毛対策メンタル支援チームの「ドクター（🔬）」です。\n"
        "1回目の議論と2回目のメンバーの発言を踏まえて、\n"
        "医学的・科学的な補足を短くまとめてください。診断はしないでください。\n\n"
        f"{risk_note}"
        "【1回目の議論】\n"
        f"サポーター: {state['encourager_response']}\n"
        f"コーチ: {state['coach_response']}\n"
        f"あなたの意見: {state['doctor_response']}\n\n"
        "【2回目】\n"
        f"サポーター: {state['encourager_response_r2']}\n"
        f"コーチ: {state['coach_response_r2']}\n\n"
        f"相談内容: {state['user_message']}\n"
    )
    try:
        text = generate_text(prompt)
    except Exception:
        text = (
            "皆さんの意見に補足すると、経過観察と生活習慣の改善が基本です。"
            "急な変化がある場合は専門医への相談をお勧めします。"
        )
    return {"doctor_response_r2": text}


def _orchestrator_node(state: _DiscussState) -> dict:
    prompt = (
        "あなたは薄毛対策メンタル支援チームの議論まとめ役です。\n"
        "2回の議論を通じて3人が意見を深めました。\n"
        "全体を統合したまとめを作成してください。\n\n"
        "【1回目】\n"
        f"サポーター: {state['encourager_response']}\n"
        f"コーチ: {state['coach_response']}\n"
        f"ドクター: {state['doctor_response']}\n\n"
        "【2回目】\n"
        f"サポーター: {state['encourager_response_r2']}\n"
        f"コーチ: {state['coach_response_r2']}\n"
        f"ドクター: {state['doctor_response_r2']}\n\n"
        '出力は必ず次のJSON形式のみ:\n'
        '{"summary": "まとめテキスト"}\n'
    )
    try:
        text = generate_text(prompt)
        data = safe_json_load(text)
        summary = data.get("summary", "")
        if not summary:
            raise ValueError("Invalid orchestrator response")
    except Exception:
        summary = "今日の最小の一手: 「同条件の写真チェックイン」か「睡眠の確保」。"
    return {"best_agent": "encourager", "summary": summary}


def _build_discuss_workflow():
    """LangGraph ワークフローを構築する。"""
    try:
        from langgraph.graph import StateGraph, START, END
    except ImportError:
        logger.warning("langgraph is not installed. /chat/discuss will use fallback.")
        return None

    graph = StateGraph(_DiscussState)
    # 1順目
    graph.add_node("detect_risk", _detect_risk_node)
    graph.add_node("encourager", _encourager_node)
    graph.add_node("coach", _coach_node)
    graph.add_node("doctor", _doctor_node)
    # 2順目
    graph.add_node("encourager_r2", _encourager_node_r2)
    graph.add_node("coach_r2", _coach_node_r2)
    graph.add_node("doctor_r2", _doctor_node_r2)
    graph.add_node("orchestrator", _orchestrator_node)

    graph.add_edge(START, "detect_risk")
    graph.add_edge("detect_risk", "encourager")
    graph.add_edge("encourager", "coach")
    graph.add_edge("coach", "doctor")
    graph.add_edge("doctor", "encourager_r2")
    graph.add_edge("encourager_r2", "coach_r2")
    graph.add_edge("coach_r2", "doctor_r2")
    graph.add_edge("doctor_r2", "orchestrator")
    graph.add_edge("orchestrator", END)

    return graph.compile()


_discuss_workflow = _build_discuss_workflow()


@router.post("/chat/discuss", response_model=MentalShieldDiscussResponse)
def mental_shield_discuss(
    payload: MentalShieldRequest, uid: str = Depends(get_current_uid)
) -> MentalShieldDiscussResponse:
    thread_id = payload.threadId or "default"

    # LangGraph ワークフローで議論を実行
    if _discuss_workflow and gemini_enabled():
        try:
            result = _discuss_workflow.invoke({
                "user_message": payload.message,
                "risk_detected": False,
                "encourager_response": "",
                "coach_response": "",
                "doctor_response": "",
                "encourager_response_r2": "",
                "coach_response_r2": "",
                "doctor_response_r2": "",
                "best_agent": "",
                "summary": "",
            })

            cards = [
                MentalShieldCard(agent="encourager", text=result["encourager_response"]),
                MentalShieldCard(agent="coach", text=result["coach_response"]),
                MentalShieldCard(agent="doctor", text=result["doctor_response"]),
                MentalShieldCard(agent="encourager", text=result["encourager_response_r2"]),
                MentalShieldCard(agent="coach", text=result["coach_response_r2"]),
                MentalShieldCard(agent="doctor", text=result["doctor_response_r2"]),
            ]
            summary = result["summary"]
            best_agent = result["best_agent"]
        except Exception as exc:
            logger.exception("LangGraph workflow failed, falling back: %s", exc)
            cards, summary = _compose_mental_shield(payload.message)
            best_agent = max(cards, key=lambda c: len(c.text)).agent
    else:
        cards, summary = _compose_mental_shield(payload.message)
        best_agent = max(cards, key=lambda c: len(c.text)).agent

    # Firestore に保存（ローカル開発時はスキップ）
    if os.getenv("ENV") != "local":
        db = get_firestore_client()
        messages_ref = (
            db.collection("conversations")
            .document(uid)
            .collection("threads")
            .document(thread_id)
            .collection("messages")
        )

        messages_ref.add(
            {
                "role": "user",
                "agent": "user",
                "text": payload.message,
                "createdAt": admin_firestore.SERVER_TIMESTAMP,
            }
        )

        for card in cards:
            messages_ref.add(
                {
                    "role": "agent",
                    "agent": card.agent,
                    "text": card.text,
                    "createdAt": admin_firestore.SERVER_TIMESTAMP,
                }
            )

        messages_ref.add(
            {
                "role": "agent",
                "agent": "orchestrator",
                "text": summary,
                "bestAgent": best_agent,
                "createdAt": admin_firestore.SERVER_TIMESTAMP,
            }
        )

    return MentalShieldDiscussResponse(
        cards=cards, summary=summary, threadId=thread_id, bestAgent=best_agent
    )
