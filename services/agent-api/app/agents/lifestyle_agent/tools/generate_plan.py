"""
Generate Weekly Plan Tool
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import random
from typing import TypedDict, List
from .recommend_actions import get_recommended_actions, ACTIONS_CATALOG, RecommendedAction

class WeeklyPlan(TypedDict):
    planId: str
    startDate: str
    endDate: str
    theme: str
    targetActions: List[RecommendedAction]
    createdScores: dict

def generate_weekly_plan(scores: dict[str, int], answers: dict[str, str]) -> WeeklyPlan:
    """
    Generate a 7-day lifestyle improvement plan based on scores.
    """
    
    # 1. Get all valid recommendations first (filtered by answers)
    grouped_actions = get_recommended_actions(scores, answers, max_actions_per_axis=5)
    
    # 2. Flatten and sort by priority/necessity across all axes
    # We want to pick the absolute most critical actions, not just per axis.
    all_candidates = []
    seen_ids = set()
    
    for axis, actions in grouped_actions.items():
        axis_score = scores.get(axis, 50)
        weight = (100 - axis_score) # Higher weight for lower score axes
        
        for action in actions:
            if action['id'] in seen_ids:
                continue
            
            # Priority logic: 
            # Action Priority (High/Med/Low) is already calculated but simplistic.
            # Let's boost priority if it targets multiple weak axes.
            
            # Simple heuristic for now:
            # Score = Weight of this axis + Bonus for "High" priority label
            score_val = weight
            if action['priority'] == 'high':
                score_val += 50
            elif action['priority'] == 'medium':
                score_val += 20
                
            all_candidates.append({
                **action,
                '_sort_score': score_val
            })
            seen_ids.add(action['id'])
            
    # Sort candidates
    all_candidates.sort(key=lambda x: x['_sort_score'], reverse=True)
    
    # 3. Pick top 3 unique actions
    target_actions = all_candidates[:3]
    
    # Remove internal sort key from output
    for a in target_actions:
        a.pop('_sort_score', None)
        
    # 4. Generate a "Theme" based on the selected actions or weakest axis
    # Find weakest axis
    sorted_axes = sorted(scores.items(), key=lambda x: x[1])
    weakest_axis = sorted_axes[0][0]
    
    themes = {
        "hormone": ["成長ホルモン活性化週間", "睡眠の質 徹底改善ウィーク", "細胞修復・再生チャレンジ"],
        "circadian": ["体内時計リセット週間", "朝活・リズム調整ウィーク", "自律神経整えチャレンジ"],
        "blood_flow": ["全身血流アップ週間", "巡りを良くする7日間", "冷え・コリ解消チャレンジ"],
        "stress": ["ストレスデトックス週間", "心と体の休息ウィーク", "コルチゾール抑制チャレンジ"],
    }
    
    theme = random.choice(themes.get(weakest_axis, ["生活習慣見直し週間"]))
    
    # 5. Build Plan Object
    now = datetime.now(ZoneInfo("Asia/Tokyo"))
    end = now + timedelta(days=6) # 7 days total including today
    
    plan: WeeklyPlan = {
        "planId": f"plan_{int(now.timestamp())}",
        "startDate": now.isoformat(),
        "endDate": end.isoformat(),
        "theme": theme,
        "targetActions": target_actions,
        "createdScores": scores
    }
    
    return plan
