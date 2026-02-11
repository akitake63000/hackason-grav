"""
Generate Weekly Plan Tool (Gemini Integration)
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import random
import json
from typing import TypedDict, List
from .recommend_actions import ACTIONS_CATALOG, should_recommend

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
