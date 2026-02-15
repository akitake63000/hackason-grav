"""
Generate Weekly Plan Tool (Gemini Integration)
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import random
import json
from typing import TypedDict, List
from .recommend_actions import ACTIONS_CATALOG, should_recommend

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

    # 4am boundary: 午前4時前は前日扱い
    if now.hour < 4:
        now = now - timedelta(days=1)

    # 今週の月曜日を計算（0=月曜, 6=日曜）
    weekday = now.weekday()
    start_of_week = now - timedelta(days=weekday)
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)

    # 今週の日曜日を計算
    end = start_of_week + timedelta(days=6, hours=23, minutes=59, seconds=59)

    plan: WeeklyPlan = {
        "planId": f"plan_{int(datetime.now(ZoneInfo('Asia/Tokyo')).timestamp())}",
        "startDate": start_of_week.isoformat(),
        "endDate": end.isoformat(),
        "theme": theme,
        "targetActions": [], # Empty initially
        "createdScores": scores,
        "createdAt": datetime.now(ZoneInfo('Asia/Tokyo')).isoformat()
    }

    return plan

def generate_daily_actions(scores: dict[str, int], answers: dict[str, str], history: List[str] = None) -> List[RecommendedAction]:
    """
    Select 3 specific actions for TODAY from the catalog based on scores.
    """
    
    # 1. Identify weak points
    weak_points = [k for k, v in scores.items() if v < 60]
    
    # 2. Score/Filter Actions
    candidates = []
    for action in ACTIONS_CATALOG:
        # Check eligibility
        if not should_recommend(action["id"], answers):
            continue
            
        # Calculate dynamic score
        # Base: targets weight
        # Bonus: if targeting a weak point
        score = 0
        primary_axis = "stress"
        max_weight = 0
        
        for axis, weight in action["targets"].items():
            if weight > max_weight:
                max_weight = weight
                primary_axis = axis
            
            # Boost if axis is weak
            if scores.get(axis, 50) < 60:
                score += weight * 2.0  # Strong boost for weak points
            else:
                score += weight * 1.0 # Normal weight
                
        # Randomize slightly to avoid same list every day
        score += random.uniform(0, 0.5)
        
        candidates.append((action, score, primary_axis))

    # 3. Sort by score
    candidates.sort(key=lambda x: x[1], reverse=True)
    
    # 4. Select Top 3 (or distinct axes?)
    # Simple top 3 for now, maybe ensure diversity validation later if needed
    selected_tuples = candidates[:3]
    
    # If less than 3, take what we have
    if len(candidates) < 3:
        selected_tuples = candidates

    # 5. Format
    result = []
    for action, _, p_axis in selected_tuples:
        result.append({
            "id": action["id"],
            "name": action["name"],
            "emoji": action["emoji"],
            "description": action.get("explanation", action["reason"]), # Use explanation for detail
            "targetAxis": p_axis,
            "priority": "high"
        })
        
    return result
