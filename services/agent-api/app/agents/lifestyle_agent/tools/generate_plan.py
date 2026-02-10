"""
Generate Weekly Plan Tool (Gemini Integration)
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import random
import json
from typing import TypedDict, List
from ....llm.vertex_gemini import generate_text
from ....services.gemini_chat import safe_json_load

class RecommendedAction(TypedDict):
    id: str
    name: str
    emoji: str
    description: str
    targetAxis: str # hormone, circadian, blood_flow, stress
    priority: str # high, medium, low

class WeeklyPlan(TypedDict):
    planId: str
    startDate: str
    endDate: str
    theme: str
    targetActions: List[RecommendedAction] # Initially empty or just for Day 1
    createdScores: dict

def generate_weekly_plan(scores: dict[str, int], answers: dict[str, str]) -> WeeklyPlan:
    """
    Generate the skeleton of a weekly plan (Theme & Dates).
    Daily actions will be generated on demand.
    """
    
    # 1. Identify weak points for Theme
    weak_points = [k for k, v in scores.items() if v < 60]
    sorted_axes = sorted(scores.items(), key=lambda x: x[1])
    weakest_axis = sorted_axes[0][0] if sorted_axes else "stress"

    themes = {
        "hormone": ["成長ホルモン活性化週間", "睡眠の質 徹底改善ウィーク", "細胞修復・再生チャレンジ"],
        "circadian": ["体内時計リセット週間", "朝活・リズム調整ウィーク", "自律神経整えチャレンジ"],
        "blood_flow": ["全身血流アップ週間", "巡りを良くする7日間", "冷え・コリ解消チャレンジ"],
        "stress": ["ストレスデトックス週間", "心と体の休息ウィーク", "コルチゾール抑制チャレンジ"],
    }
    theme = random.choice(themes.get(weakest_axis, ["生活習慣見直し週間"]))

    # 2. Build Plan Object (Empty actions for now, user will generate daily)
    now = datetime.now(ZoneInfo("Asia/Tokyo"))
    end = now + timedelta(days=6)
    
    plan: WeeklyPlan = {
        "planId": f"plan_{int(now.timestamp())}",
        "startDate": now.isoformat(),
        "endDate": end.isoformat(),
        "theme": theme,
        "targetActions": [], # Empty initially
        "createdScores": scores
    }
    
    return plan


def generate_daily_actions(scores: dict[str, int], answers: dict[str, str], history: List[str] = None) -> List[RecommendedAction]:
    """
    Generate 3 specific actions for TODAY using Gemini.
    """
    history = history or []
    
    # Identify weak points
    weak_points = [k for k, v in scores.items() if v < 60]
    if not weak_points:
        weak_points = ["全体的な質の向上"]

    # Format answers
    substances = answers.get("substances", "なし")
    exercise = answers.get("exercise_frequency", "なし")

    prompt = f"""
    あなたはプロの生活習慣改善アドバイザーです。
    ユーザーの診断結果に基づき、**今日1日で行うべき3つの具体的アクション**を生成してください。
    
    ## ユーザー情報
    - 診断スコア (0-100点): {json.dumps(scores, ensure_ascii=False)}
    - 弱点項目: {", ".join(weak_points)}
    - 嗜好品: {substances}
    - 運動習慣: {exercise}
    - 過去の提案（重複を避けるため）: {", ".join(history[-10:])}

    ## 生成ルール
    1. **具体的アクション**: 「運動する」ではなく「駅のエスカレーターを使わず階段を使う」のように。
    2. **シンプルに**: アクション名は20文字以内。説明は簡潔に。
    3. **アンケート考慮**: 喫煙しない人に禁煙を勧めないこと。
    4. **多様性**: 3つのうち少なくとも1つは弱点項目に関連するもの。残りもバランスよく。
    5. 出力は必ず以下の**JSON形式**のみ。

    ## 出力JSON
    {{
      "actions": [
        {{
          "name": "アクション名（20文字以内）",
          "emoji": "絵文字",
          "description": "簡潔な理由・補足（30文字以内）",
          "targetAxis": "hormone, circadian, blood_flow, stress のいずれか",
          "priority": "high"
        }}
        ... (3つ)
      ]
    }}
    """

    try:
        response_text = generate_text(prompt)
        data = safe_json_load(response_text)
        
        if not data or "actions" not in data:
            raise ValueError("Invalid JSON from Gemini")
            
        actions = []
        for i, item in enumerate(data.get("actions", [])):
            actions.append({
                "id": f"daily_{int(datetime.now().timestamp())}_{i}",
                "name": item.get("name", "アクション"),
                "emoji": item.get("emoji", "✨"),
                "description": item.get("description", "健康のために実行しましょう。"),
                "targetAxis": item.get("targetAxis", "stress"),
                "priority": "high"
            })
        return actions

    except Exception as e:
        print(f"Gemini daily generation failed: {e}")
        # Fallback
        # Fallback pool
        fallback_pool = [
            {"name": "コップ1杯の水を飲む", "emoji": "💧", "description": "血流を促し、水分補給を行いましょう。", "targetAxis": "blood_flow"},
            {"name": "深呼吸を3回する", "emoji": "🧘", "description": "深く息を吸って、ストレスを軽減します。", "targetAxis": "stress"},
            {"name": "スマホを置いて5分休む", "emoji": "👀", "description": "デジタルデトックスで目を休めましょう。", "targetAxis": "circadian"},
            {"name": "朝日を浴びる", "emoji": "☀️", "description": "体内時計をリセットし、自律神経を整えます。", "targetAxis": "circadian"},
            {"name": "肩を10回回す", "emoji": "💪", "description": "肩甲骨周りをほぐして血流を改善します。", "targetAxis": "blood_flow"},
            {"name": "寝る1時間前のスマホ断ち", "emoji": "📵", "description": "睡眠の質を高めるための準備です。", "targetAxis": "hormone"},
            {"name": "好きな音楽を聴く", "emoji": "🎵", "description": "リラックスして心拍数を落ち着けます。", "targetAxis": "stress"},
            {"name": "階段を使う", "emoji": "🚶", "description": "日常動作の中で運動量を増やしましょう。", "targetAxis": "blood_flow"},
        ]
        
        selected = random.sample(fallback_pool, 3)
        return [
            {
                "id": f"fb_{int(datetime.now().timestamp())}_{i}",
                "name": item["name"],
                "emoji": item["emoji"],
                "description": item["description"],
                "targetAxis": item["targetAxis"],
                "priority": "high"
            }
            for i, item in enumerate(selected)
        ]
