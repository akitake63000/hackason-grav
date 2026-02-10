import asyncio
import json
import logging
import os
import threading
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Tuple, TypedDict

from fastapi import APIRouter, Depends, HTTPException, Request
from firebase_admin import firestore as admin_firestore
from pydantic import BaseModel, Field, field_validator

try:
    from google.cloud import tasks_v2
    CLOUD_TASKS_AVAILABLE = True
except ImportError:
    CLOUD_TASKS_AVAILABLE = False

from ..auth import get_current_uid
from ..firebase import get_firestore_client
from ..config import GEMINI_MODEL, GEMINI_MODEL_HEAVY
from ..middleware.rate_limit import limiter
from ..services.gemini_chat import gemini_enabled, generate_text, safe_json_load

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/mental-shield", tags=["mental-shield"])


class MentalShieldRequest(BaseModel):
    threadId: Optional[str] = Field(default="default", max_length=100, description="Thread ID for conversation history")
    message: str = Field(..., min_length=1, max_length=2000, description="User message for mental shield agent")
    mode: Optional[str] = Field(default="balanced", pattern="^(balanced|supportive|analytical)$", description="Response mode")
    style: Optional[str] = "balanced"    # gentle / balanced / strict
    detail: Optional[str] = "flash"      # flash (gemini-2.5-flash) / pro (gemini-2.5-pro)

    @field_validator('message')
    @classmethod
    def validate_message(cls, v):
        if not v.strip():
            raise ValueError('Message cannot be empty or whitespace only')
        return v.strip()


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
    style: str = "balanced",
    detail: str = "flash",
) -> Tuple[Optional[List[MentalShieldCard]], Optional[str]]:
    if not gemini_enabled():
        return None, None

    model = _model_for_detail(detail)
    si = _style_instruction(style, detail)
    mt = _max_tokens_for_detail(detail)
    prompt = (
        "あなたは薄毛対策のメンタル支援エージェントです。"
        "以下の相談内容に対して、3人格（encourager/coach/doctor）の短い回答と"
        "まとめを日本語で返してください。診断はしないでください。\n"
        f"{si}"
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
        text = generate_text(prompt, model=model, max_output_tokens=mt)
        data = safe_json_load(text)
    except (ValueError, json.JSONDecodeError, RuntimeError) as e:
        logger.warning(f"Failed to generate mental shield response with LLM: {e}")
        return None, None
    except Exception as e:
        logger.error(f"Unexpected error in mental shield LLM generation: {e}", exc_info=True)
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


def _compose_mental_shield(
    message: str, style: str = "balanced", detail: str = "flash"
) -> Tuple[List[MentalShieldCard], str]:
    risk = _contains_risk_keywords(message)

    llm_cards, llm_summary = _generate_mental_with_llm(message, style=style, detail=detail)
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
@limiter.limit("10/minute")
def mental_shield_chat(
    request: Request, payload: MentalShieldRequest, uid: str = Depends(get_current_uid)
) -> MentalShieldResponse:
    thread_id = payload.threadId or "default"
    cards, summary = _compose_mental_shield(
        payload.message, style=payload.style or "balanced", detail=payload.detail or "flash"
    )

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
    style: str
    detail: str
    risk_detected: bool
    encourager_response: str
    coach_response: str
    doctor_response: str
    encourager_response_r2: str
    coach_response_r2: str
    doctor_response_r2: str
    best_agent: str
    summary: str


def _max_tokens_for_detail(detail: str) -> int | None:
    """detail 設定に応じた max_output_tokens を返す（現在は制限なし）。"""
    return None


def _model_for_detail(detail: str) -> str:
    """detail 設定に応じた Gemini モデルを返す。"""
    if detail == "pro":
        return GEMINI_MODEL_HEAVY  # gemini-2.5-pro
    return GEMINI_MODEL  # gemini-2.5-flash


def _style_instruction(style: str, detail: str) -> str:
    """style と detail の設定からプロンプト指示文を生成する。"""
    tone = {
        "gentle": "相談者の気持ちに最大限寄り添い、安心感を与える優しい口調で回答してください。",
        "balanced": "共感しつつも、必要な情報はしっかり伝えるバランスの取れた口調で回答してください。",
        "strict": "率直かつ的確に、甘えを許さないストレートな口調で回答してください。",
    }.get(style, "共感しつつも、必要な情報はしっかり伝えるバランスの取れた口調で回答してください。")
    length = {
        "flash": "回答は3〜4文程度で簡潔にまとめてください。",
        "pro": "回答はエビデンスや具体例を交えて詳しく説明してください。",
    }.get(detail, "回答は3〜4文程度で簡潔にまとめてください。")
    return f"{tone}\n{length}\n"


def _detect_risk_node(state: _DiscussState) -> dict:
    return {"risk_detected": _contains_risk_keywords(state["user_message"])}


def _encourager_node(state: _DiscussState) -> dict:
    detail = state.get("detail", "flash")
    model = _model_for_detail(detail)
    si = _style_instruction(state.get("style", "balanced"), detail)
    mt = _max_tokens_for_detail(detail)
    prompt = (
        "あなたは薄毛対策メンタル支援チームの「サポーター（❤️）」です。\n"
        "臨床心理士・認知行動療法（CBT）の専門家として回答してください。\n"
        "- 相談者の認知の歪み（破局的思考・白黒思考など）があれば優しく指摘する\n"
        "- 「できていること」に焦点を当て、自己効力感を高める\n"
        "- 薄毛の悩みは外見不安（body image concern）であることを踏まえて対応する\n\n"
        f"{si}"
        f"相談内容: {state['user_message']}\n"
    )
    try:
        text = generate_text(prompt, model=model, max_output_tokens=mt)
        if not text.strip():
            raise ValueError("Empty response from LLM")
    except Exception as e:
        logger.error(f"[encourager] LLM failed: model={model}, mt={mt}, error={type(e).__name__}: {e}")
        text = (
            "不安に感じるのは自然な反応です。今ここで一緒に整理しましょう。"
            "継続できている点を思い出せていますか？"
        )
    return {"encourager_response": text}


def _coach_node(state: _DiscussState) -> dict:
    detail = state.get("detail", "flash")
    model = _model_for_detail(detail)
    si = _style_instruction(state.get("style", "balanced"), detail)
    mt = _max_tokens_for_detail(detail)
    prompt = (
        "あなたは薄毛対策メンタル支援チームの「コーチ（💪）」です。\n"
        "毛髪診断士・生活習慣改善の専門家として回答してください。\n"
        "- 睡眠（成長ホルモン分泌）、栄養（亜鉛・ビオチン・タンパク質）、頭皮ケアの観点からアドバイスする\n"
        "- 具体的で今日から実行できるアクションを1〜2個提案する\n"
        "- 効果が出るまでの目安期間にも言及する（ヘアサイクルは3〜6ヶ月）\n\n"
        f"{si}"
        "チームメンバーのサポーターが以下の意見を出しています:\n"
        f"サポーターの意見: {state['encourager_response']}\n\n"
        "サポーターの意見を踏まえつつ、以下の相談に回答してください。\n"
        f"相談内容: {state['user_message']}\n"
    )
    try:
        text = generate_text(prompt, model=model, max_output_tokens=mt)
        if not text.strip():
            raise ValueError("Empty response from LLM")
    except Exception as e:
        logger.error(f"[coach] LLM failed: model={model}, mt={mt}, error={type(e).__name__}: {e}")
        text = (
            "今日の最小の一手は「同条件で写真を撮る」か「睡眠を30分確保する」。"
            "1つだけやり切ろう。"
        )
    return {"coach_response": text}


def _doctor_node(state: _DiscussState) -> dict:
    detail = state.get("detail", "flash")
    model = _model_for_detail(detail)
    si = _style_instruction(state.get("style", "balanced"), detail)
    mt = _max_tokens_for_detail(detail)
    risk_note = ""
    if state.get("risk_detected"):
        risk_note = "※相談内容に医療リスクに関するキーワードが含まれています。必要に応じて受診を勧めてください。\n"

    prompt = (
        "あなたは薄毛対策メンタル支援チームの「ドクター（🔬）」です。\n"
        "皮膚科専門医・毛髪科学の研究者として回答してください。\n"
        "- AGA（男性型脱毛症）、FPHL（女性型脱毛症）、休止期脱毛などの知識に基づく\n"
        "- ミノキシジル、フィナステリド、デュタステリド等の一般的なエビデンスに言及してよい\n"
        "- ただし個人への診断・処方は行わず「一般的な医学知識」として情報提供する\n"
        "- 必要に応じて皮膚科受診を推奨する\n\n"
        f"{si}"
        f"{risk_note}"
        "チームメンバーが以下の意見を出しています:\n"
        f"サポーターの意見: {state['encourager_response']}\n"
        f"コーチの意見: {state['coach_response']}\n\n"
        "2人の意見を踏まえつつ、以下の相談に回答してください。\n"
        f"相談内容: {state['user_message']}\n"
    )
    try:
        text = generate_text(prompt, model=model, max_output_tokens=mt)
        if not text.strip():
            raise ValueError("Empty response from LLM")
    except Exception as e:
        logger.error(f"[doctor] LLM failed: model={model}, mt={mt}, error={type(e).__name__}: {e}")
        text = (
            "一般論として、抜け毛は睡眠・ストレス・栄養の影響を受けます。"
            "ただし診断はできません。変化が急でなければ、同条件での経過観察が有効です。"
        )
    return {"doctor_response": text}


def _encourager_node_r2(state: _DiscussState) -> dict:
    detail = state.get("detail", "flash")
    model = _model_for_detail(detail)
    si = _style_instruction(state.get("style", "balanced"), detail)
    mt = _max_tokens_for_detail(detail)
    prompt = (
        "あなたは薄毛対策メンタル支援チームの「サポーター（❤️）」です。\n"
        "臨床心理士・認知行動療法（CBT）の専門家として回答してください。\n"
        "1回目の議論で3人がそれぞれ専門的な意見を出しました。\n"
        "それを踏まえて、相談者の心理面でのケアポイントをまとめてください。\n\n"
        f"{si}"
        "【1回目の議論】\n"
        f"あなたの意見: {state['encourager_response']}\n"
        f"コーチの意見: {state['coach_response']}\n"
        f"ドクターの意見: {state['doctor_response']}\n\n"
        f"相談内容: {state['user_message']}\n"
    )
    try:
        text = generate_text(prompt, model=model, max_output_tokens=mt)
        if not text.strip():
            raise ValueError("Empty response from LLM")
    except Exception as e:
        logger.error(f"[encourager_r2] LLM failed: model={model}, mt={mt}, error={type(e).__name__}: {e}")
        text = (
            "皆さんの意見を聞いて、まず気持ちを整理することが大切だと改めて感じます。"
            "焦らず一歩ずつ進みましょう。"
        )
    return {"encourager_response_r2": text}


def _coach_node_r2(state: _DiscussState) -> dict:
    detail = state.get("detail", "flash")
    model = _model_for_detail(detail)
    si = _style_instruction(state.get("style", "balanced"), detail)
    mt = _max_tokens_for_detail(detail)
    prompt = (
        "あなたは薄毛対策メンタル支援チームの「コーチ（💪）」です。\n"
        "毛髪診断士・生活習慣改善の専門家として回答してください。\n"
        "1回目の議論とサポーターの2回目の発言を踏まえて、\n"
        "最も効果的な具体アクションを1つだけ提案してください。\n\n"
        f"{si}"
        "【1回目の議論】\n"
        f"サポーター: {state['encourager_response']}\n"
        f"あなたの意見: {state['coach_response']}\n"
        f"ドクター: {state['doctor_response']}\n\n"
        "【2回目】\n"
        f"サポーター: {state['encourager_response_r2']}\n\n"
        f"相談内容: {state['user_message']}\n"
    )
    try:
        text = generate_text(prompt, model=model, max_output_tokens=mt)
        if not text.strip():
            raise ValueError("Empty response from LLM")
    except Exception as e:
        logger.error(f"[coach_r2] LLM failed: model={model}, mt={mt}, error={type(e).__name__}: {e}")
        text = (
            "議論を踏まえて、今日やるべきことは1つ。"
            "「同条件で写真を撮って記録する」これだけやりましょう。"
        )
    return {"coach_response_r2": text}


def _doctor_node_r2(state: _DiscussState) -> dict:
    detail = state.get("detail", "flash")
    model = _model_for_detail(detail)
    si = _style_instruction(state.get("style", "balanced"), detail)
    mt = _max_tokens_for_detail(detail)
    risk_note = ""
    if state.get("risk_detected"):
        risk_note = "※医療リスクキーワードあり。必要に応じて受診を勧めてください。\n"

    prompt = (
        "あなたは薄毛対策メンタル支援チームの「ドクター（🔬）」です。\n"
        "皮膚科専門医・毛髪科学の研究者として回答してください。\n"
        "1回目の議論と2回目のメンバーの発言を踏まえて、\n"
        "医学的・科学的な最終見解を述べてください。診断はしないでください。\n\n"
        f"{si}"
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
        text = generate_text(prompt, model=model, max_output_tokens=mt)
        if not text.strip():
            raise ValueError("Empty response from LLM")
    except Exception as e:
        logger.error(f"[doctor_r2] LLM failed: model={model}, mt={mt}, error={type(e).__name__}: {e}")
        text = (
            "皆さんの意見に補足すると、経過観察と生活習慣の改善が基本です。"
            "急な変化がある場合は専門医への相談をお勧めします。"
        )
    return {"doctor_response_r2": text}


def _orchestrator_node(state: _DiscussState) -> dict:
    detail = state.get("detail", "flash")
    model = _model_for_detail(detail)
    si = _style_instruction(state.get("style", "balanced"), detail)
    mt = _max_tokens_for_detail(detail)
    prompt = (
        "あなたは薄毛対策メンタル支援チームの議論まとめ役です。\n"
        "臨床心理士・毛髪診断士・皮膚科医の3専門家が2回議論しました。\n"
        "全体を統合し、相談者にとって最も有益なまとめを作成してください。\n"
        "メンタルケア・生活習慣・医学的観点のバランスを意識してください。\n"
        "JSONや装飾は不要です。まとめの文章だけを出力してください。\n\n"
        f"{si}"
        "【1回目】\n"
        f"サポーター（臨床心理士）: {state['encourager_response']}\n"
        f"コーチ（毛髪診断士）: {state['coach_response']}\n"
        f"ドクター（皮膚科医）: {state['doctor_response']}\n\n"
        "【2回目】\n"
        f"サポーター: {state['encourager_response_r2']}\n"
        f"コーチ: {state['coach_response_r2']}\n"
        f"ドクター: {state['doctor_response_r2']}\n\n"
    )
    try:
        summary = generate_text(prompt, model=model, max_output_tokens=mt)
        if not summary.strip():
            raise ValueError("Empty response from LLM")
        summary = summary.strip()
    except Exception as e:
        logger.error(f"[orchestrator] LLM failed: model={model}, mt={mt}, error={type(e).__name__}: {e}")
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
@limiter.limit("10/minute")
def mental_shield_discuss(
    request: Request, payload: MentalShieldRequest, uid: str = Depends(get_current_uid)
) -> MentalShieldDiscussResponse:
    thread_id = payload.threadId or "default"

    # LangGraph ワークフローで議論を実行
    if _discuss_workflow and gemini_enabled():
        try:
            result = _discuss_workflow.invoke({
                "user_message": payload.message,
                "style": payload.style or "balanced",
                "detail": payload.detail or "flash",
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
            cards, summary = _compose_mental_shield(
                payload.message, style=payload.style or "balanced", detail=payload.detail or "flash"
            )
            best_agent = max(cards, key=lambda c: len(c.text)).agent
    else:
        cards, summary = _compose_mental_shield(
            payload.message, style=payload.style or "balanced", detail=payload.detail or "flash"
        )
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


# ---------------------------------------------------------------------------
# /debug/test-models - デバッグ用: モデルの動作確認エンドポイント
# ---------------------------------------------------------------------------

@router.get("/debug/test-models")
def debug_test_models():
    """各モデルで短いテキスト生成を試み、成功/失敗を返す。"""
    results = {}
    test_prompt = "「こんにちは」と一言だけ返してください。"

    for label, model_name in [("flash", GEMINI_MODEL), ("heavy", GEMINI_MODEL_HEAVY)]:
        try:
            text = generate_text(test_prompt, model=model_name, max_output_tokens=50)
            results[label] = {"model": model_name, "ok": True, "response": text[:100]}
        except Exception as e:
            results[label] = {"model": model_name, "ok": False, "error": f"{type(e).__name__}: {e}"}

    # max_output_tokens なしでも試す
    try:
        text = generate_text(test_prompt, model=GEMINI_MODEL)
        results["flash_no_token_limit"] = {"model": GEMINI_MODEL, "ok": True, "response": text[:100]}
    except Exception as e:
        results["flash_no_token_limit"] = {"model": GEMINI_MODEL, "ok": False, "error": f"{type(e).__name__}: {e}"}

    results["config"] = {
        "GEMINI_MODEL": GEMINI_MODEL,
        "GEMINI_MODEL_HEAVY": GEMINI_MODEL_HEAVY,
        "gemini_enabled": gemini_enabled(),
    }
    return results


# ---------------------------------------------------------------------------
# 非同期チャット処理エンドポイント
# ---------------------------------------------------------------------------


class AsyncTaskResponse(BaseModel):
    taskId: str
    status: str


class TaskStatusResponse(BaseModel):
    userId: str
    conversationId: str
    status: str  # queued, running, succeeded, failed, timeout
    mode: str
    createdAt: Optional[str] = None
    startedAt: Optional[str] = None
    finishedAt: Optional[str] = None
    messageId: Optional[str] = None
    error: Optional[str] = None


def _execute_discuss_workflow_sync(
    task_id: str,
    uid: str,
    message: str,
    style: str,
    detail: str,
    thread_id: str
):
    """
    非同期タスクの実際の処理（バックグラウンドスレッドで実行）
    """
    db = get_firestore_client()
    task_ref = db.collection("users").document(uid).collection("chatTasks").document(task_id)

    try:
        # ステータスを running に更新
        task_ref.update({
            "status": "running",
            "startedAt": admin_firestore.SERVER_TIMESTAMP,
        })

        logger.info(f"Starting async task {task_id} for user {uid}")

        # LangGraph ワークフローで議論を実行
        if _discuss_workflow and gemini_enabled():
            try:
                result = _discuss_workflow.invoke({
                    "user_message": message,
                    "style": style,
                    "detail": detail,
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
                cards, summary = _compose_mental_shield(message, style=style, detail=detail)
                best_agent = max(cards, key=lambda c: len(c.text)).agent
        else:
            cards, summary = _compose_mental_shield(message, style=style, detail=detail)
            best_agent = max(cards, key=lambda c: len(c.text)).agent

        # Firestore に結果を保存
        messages_ref = (
            db.collection("conversations")
            .document(uid)
            .collection("threads")
            .document(thread_id)
            .collection("messages")
        )

        # ユーザーメッセージ
        messages_ref.add({
            "role": "user",
            "agent": "user",
            "text": message,
            "createdAt": admin_firestore.SERVER_TIMESTAMP,
            "taskId": task_id,
        })

        # AIレスポンスカード
        for card in cards:
            messages_ref.add({
                "role": "agent",
                "agent": card.agent,
                "text": card.text,
                "createdAt": admin_firestore.SERVER_TIMESTAMP,
                "taskId": task_id,
            })

        # サマリーメッセージID
        message_doc = messages_ref.add({
            "role": "agent",
            "agent": "orchestrator",
            "text": summary,
            "bestAgent": best_agent,
            "createdAt": admin_firestore.SERVER_TIMESTAMP,
            "taskId": task_id,
        })

        # タスクを succeeded に更新
        task_ref.update({
            "status": "succeeded",
            "finishedAt": admin_firestore.SERVER_TIMESTAMP,
            "messageId": message_doc[1].id,  # message_doc is (timestamp, DocumentReference)
        })

        logger.info(f"Task {task_id} completed successfully")

    except Exception as e:
        logger.error(f"Task {task_id} failed with error: {e}", exc_info=True)
        # エラー時は failed に更新
        task_ref.update({
            "status": "failed",
            "finishedAt": admin_firestore.SERVER_TIMESTAMP,
            "error": str(e)[:500],  # エラーメッセージは500文字まで
        })


@router.post("/chat/discuss-async", response_model=AsyncTaskResponse)
@limiter.limit("10/minute")
def mental_shield_discuss_async(
    request: Request, payload: MentalShieldRequest, uid: str = Depends(get_current_uid)
) -> AsyncTaskResponse:
    """
    非同期チャット処理を開始（タスクID即座返却）

    開発環境（ENV=local, ENV=development）では、Cloud Tasksの代わりに
    バックグラウンドスレッドで処理を実行します。

    本番環境では、Cloud Tasksにタスクをenqueueする必要があります（未実装）。
    """
    thread_id = payload.threadId or "default"
    task_id = str(uuid.uuid4())

    # Firestore にタスクを作成
    db = get_firestore_client()
    task_ref = db.collection("users").document(uid).collection("chatTasks").document(task_id)

    # TTLは30分後
    ttl_time = datetime.utcnow() + timedelta(minutes=30)

    task_ref.set({
        "userId": uid,
        "conversationId": thread_id,
        "status": "queued",
        "mode": payload.detail or "flash",
        "input": {
            "message": payload.message,
            "character": "default",  # 今回はcharacterは使用しない
            "detailLevel": payload.detail or "flash",
            "style": payload.style or "balanced",
        },
        "createdAt": admin_firestore.SERVER_TIMESTAMP,
        "ttl": ttl_time,
    })

    # 環境変数で開発環境かどうか判定
    env = os.getenv("ENV", "production")

    if env in ("local", "development"):
        # 開発環境: バックグラウンドスレッドで直接実行
        logger.info(f"Development mode: executing task {task_id} in background thread")

        thread = threading.Thread(
            target=_execute_discuss_workflow_sync,
            args=(
                task_id,
                uid,
                payload.message,
                payload.style or "balanced",
                payload.detail or "flash",
                thread_id
            )
        )
        thread.daemon = True
        thread.start()
    else:
        # 本番環境: Cloud Tasks にenqueue
        if not CLOUD_TASKS_AVAILABLE:
            logger.error("Cloud Tasks library not available, falling back to threading")
            thread = threading.Thread(
                target=_execute_discuss_workflow_sync,
                args=(
                    task_id,
                    uid,
                    payload.message,
                    payload.style or "balanced",
                    payload.detail or "flash",
                    thread_id
                )
            )
            thread.daemon = True
            thread.start()
        else:
            logger.info(f"Production mode: enqueuing task {task_id} to Cloud Tasks")

            # Cloud Tasks設定
            project_id = os.getenv("GCP_PROJECT_ID", "hackason-grab")
            location = os.getenv("GCP_REGION", "asia-northeast1")
            queue = "chat-processing-queue"
            cloud_run_url = os.getenv("CLOUD_RUN_URL", "agent-api-7wsihnjf7q-an.a.run.app")
            service_account_email = os.getenv("SERVICE_ACCOUNT_EMAIL", "54206639421-compute@developer.gserviceaccount.com")

            # Cloud Tasksクライアント作成
            client = tasks_v2.CloudTasksClient()
            parent = client.queue_path(project_id, location, queue)

            # タスクURL
            task_url = f"https://{cloud_run_url}/api/v1/mental-shield/tasks/{task_id}/execute"

            # タスク作成
            task = {
                "http_request": {
                    "http_method": tasks_v2.HttpMethod.POST,
                    "url": task_url,
                    "headers": {
                        "Content-Type": "application/json",
                    },
                    "body": json.dumps({
                        "task_id": task_id,
                        "user_id": uid
                    }).encode(),
                    "oidc_token": {
                        "service_account_email": service_account_email
                    }
                }
            }

            # Cloud Tasksにenqueue
            try:
                response = client.create_task(request={"parent": parent, "task": task})
                logger.info(f"Task {task_id} enqueued to Cloud Tasks: {response.name}")
            except Exception as e:
                logger.error(f"Failed to enqueue task {task_id} to Cloud Tasks: {e}")
                # フォールバック: スレッドで実行
                thread = threading.Thread(
                    target=_execute_discuss_workflow_sync,
                    args=(
                        task_id,
                        uid,
                        payload.message,
                        payload.style or "balanced",
                        payload.detail or "flash",
                        thread_id
                    )
                )
                thread.daemon = True
                thread.start()

    return AsyncTaskResponse(taskId=task_id, status="queued")


class ExecuteTaskRequest(BaseModel):
    task_id: str
    user_id: str


@router.post("/tasks/{task_id}/execute")
async def execute_task(task_id: str, request_body: ExecuteTaskRequest):
    """
    Cloud Tasksから呼ばれる実際の処理エンドポイント（内部用）

    このエンドポイントはCloud TasksのOIDCトークンで保護されているため、
    Firebase認証は不要です。
    """
    uid = request_body.user_id
    db = get_firestore_client()

    task_ref = db.collection("users").document(uid).collection("chatTasks").document(task_id)
    task_doc = task_ref.get()

    if not task_doc.exists:
        logger.error(f"Task {task_id} not found for user {uid}")
        raise HTTPException(status_code=404, detail="Task not found")

    task_data = task_doc.to_dict()

    # タスクデータから必要な情報を取得
    thread_id = task_data["conversationId"]
    input_data = task_data["input"]
    message = input_data["message"]
    style = input_data.get("style", "balanced")
    detail = input_data.get("detailLevel", "flash")

    # 実際の処理を実行（同期関数を別スレッドで実行）
    # Note: FastAPIの async 関数内でも、同期関数をブロッキング呼び出しすると
    # パフォーマンス問題が起きるため、run_in_executorを使用
    import concurrent.futures
    loop = asyncio.get_event_loop()
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)

    await loop.run_in_executor(
        executor,
        _execute_discuss_workflow_sync,
        task_id,
        uid,
        message,
        style,
        detail,
        thread_id
    )

    return {"status": "success"}


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
def get_task_status(task_id: str, uid: str = Depends(get_current_uid)) -> TaskStatusResponse:
    """
    タスク状態取得（フロントエンドのポーリング用）
    """
    db = get_firestore_client()
    task_ref = db.collection("users").document(uid).collection("chatTasks").document(task_id)
    task_doc = task_ref.get()

    if not task_doc.exists:
        raise HTTPException(status_code=404, detail="Task not found")

    task_data = task_doc.to_dict()

    # Timestampをstr変換
    created_at = task_data.get("createdAt")
    started_at = task_data.get("startedAt")
    finished_at = task_data.get("finishedAt")

    return TaskStatusResponse(
        userId=task_data["userId"],
        conversationId=task_data["conversationId"],
        status=task_data["status"],
        mode=task_data["mode"],
        createdAt=created_at.isoformat() if created_at else None,
        startedAt=started_at.isoformat() if started_at else None,
        finishedAt=finished_at.isoformat() if finished_at else None,
        messageId=task_data.get("messageId"),
        error=task_data.get("error"),
    )
