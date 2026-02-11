"""
User Activity Analysis Tool

Analyzes user's comprehensive activity history across all features:
- Photo capture history (last photo date, frequency)
- Meal logging history (recent activity, trends)
- Plan completion status (streak, completion rate)
- Tendency scores (4-axis weakest point)
- Overall engagement level
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import TypedDict
from firebase_admin import firestore
from google.cloud.firestore_v1.field_path import FieldPath


class UserActivityMetrics(TypedDict):
    """User activity metrics aggregated from all Firestore collections"""
    # Photo capture
    days_since_last_photo: int | None  # None if never captured
    photo_frequency: str  # "regular" | "sporadic" | "inactive"

    # Meal logging
    meals_logged_last_week: int  # Count of meals logged in last 7 days
    meal_logging_trend: str  # "increasing" | "stable" | "decreasing"

    # Plan completion
    current_streak: int  # Consecutive days with at least 1 action completed
    plan_completion_rate: float  # 0.0-1.0, last 7 days

    # 4-axis scores
    weakest_axis: str  # "hormone" | "circadian" | "blood_flow" | "stress"
    weakest_score: int  # 0-100

    # Overall engagement
    engagement_level: str  # "high" | "medium" | "low"


async def analyze_photo_activity(uid: str, db: firestore.Client) -> dict:
    """
    Analyze photo capture history
    Returns: { days_since_last_photo, photo_frequency }
    """
    try:
        # Query latest photo
        photos_ref = db.collection("users").document(uid).collection("photos")
        photos = photos_ref.order_by("capturedAt", direction=firestore.Query.DESCENDING).limit(10).stream()

        photos_list = [p.to_dict() for p in photos]

        if not photos_list:
            return {
                "days_since_last_photo": None,
                "photo_frequency": "inactive"
            }

        # Calculate days since last photo
        now = datetime.now(ZoneInfo("Asia/Tokyo"))
        latest_photo = photos_list[0]
        captured_at_str = latest_photo.get("capturedAt")

        if not captured_at_str:
            return {
                "days_since_last_photo": None,
                "photo_frequency": "inactive"
            }

        # Parse ISO timestamp
        captured_at = datetime.fromisoformat(captured_at_str.replace("Z", "+00:00"))
        captured_at = captured_at.astimezone(ZoneInfo("Asia/Tokyo"))
        days_since = (now - captured_at).days

        # Determine frequency based on recent history
        if len(photos_list) >= 3:
            # Check if photos are regular (e.g., at least 1 per week in last 3 photos)
            intervals = []
            for i in range(len(photos_list) - 1):
                current = datetime.fromisoformat(photos_list[i].get("capturedAt", "").replace("Z", "+00:00"))
                next_photo = datetime.fromisoformat(photos_list[i + 1].get("capturedAt", "").replace("Z", "+00:00"))
                interval = (current - next_photo).days
                intervals.append(interval)

            avg_interval = sum(intervals) / len(intervals) if intervals else 999

            if avg_interval <= 7:
                frequency = "regular"
            elif avg_interval <= 14:
                frequency = "sporadic"
            else:
                frequency = "inactive"
        else:
            frequency = "sporadic" if days_since <= 14 else "inactive"

        return {
            "days_since_last_photo": days_since,
            "photo_frequency": frequency
        }

    except Exception as e:
        print(f"Error analyzing photo activity: {e}")
        return {
            "days_since_last_photo": None,
            "photo_frequency": "inactive"
        }


async def analyze_meal_activity(uid: str, db: firestore.Client) -> dict:
    """
    Analyze meal logging history
    Returns: { meals_logged_last_week, meal_logging_trend }
    """
    try:
        now = datetime.now(ZoneInfo("Asia/Tokyo"))
        week_ago = now - timedelta(days=7)
        two_weeks_ago = now - timedelta(days=14)

        # Query meals from last 2 weeks for trend analysis
        meals_ref = db.collection("users").document(uid).collection("mealAnalysis")
        meals = meals_ref.order_by("analyzedAt", direction=firestore.Query.DESCENDING).limit(50).stream()

        meals_list = [m.to_dict() for m in meals]

        # Count meals in different periods
        last_week_count = 0
        prev_week_count = 0

        for meal in meals_list:
            analyzed_at_str = meal.get("analyzedAt")
            if not analyzed_at_str:
                continue

            analyzed_at = datetime.fromisoformat(analyzed_at_str.replace("Z", "+00:00"))
            analyzed_at = analyzed_at.astimezone(ZoneInfo("Asia/Tokyo"))

            if analyzed_at >= week_ago:
                last_week_count += 1
            elif analyzed_at >= two_weeks_ago:
                prev_week_count += 1

        # Determine trend
        if prev_week_count == 0:
            trend = "stable" if last_week_count > 0 else "decreasing"
        else:
            ratio = last_week_count / prev_week_count if prev_week_count > 0 else 1.0
            if ratio > 1.2:
                trend = "increasing"
            elif ratio < 0.8:
                trend = "decreasing"
            else:
                trend = "stable"

        return {
            "meals_logged_last_week": last_week_count,
            "meal_logging_trend": trend
        }

    except Exception as e:
        print(f"Error analyzing meal activity: {e}")
        return {
            "meals_logged_last_week": 0,
            "meal_logging_trend": "stable"
        }


async def analyze_plan_activity(uid: str, db: firestore.Client) -> dict:
    """
    Analyze plan completion status
    Returns: { current_streak, plan_completion_rate }

    Reuses existing streak calculation logic from lifestyle.py
    """
    try:
        # Get active plan
        plans_ref = db.collection("users").document(uid).collection("plans")
        query = plans_ref.where("status", "==", "active").limit(1)
        docs = list(query.get())

        if not docs:
            return {
                "current_streak": 0,
                "plan_completion_rate": 0.0
            }

        plan_doc = docs[0]

        # Calculate streak (based on existing logic from lifestyle.py _calculate_streak)
        logs = plan_doc.reference.collection("logs").order_by(
            FieldPath.document_id(),
            direction=firestore.Query.DESCENDING
        ).limit(14).stream()

        streak = 0
        now = datetime.now(ZoneInfo("Asia/Tokyo"))
        check_date = now - timedelta(days=1)
        if now.hour < 4:
            check_date = now - timedelta(days=2)

        # Map logs to dict
        log_map = {}
        for log in logs:
            data = log.to_dict()
            if data.get("completedActions"):
                log_map[log.id] = True

        # Check if today has completion
        today_str = now.strftime("%Y-%m-%d")
        if now.hour < 4:
            today_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")

        if log_map.get(today_str):
            streak += 1

        # Count backwards for consecutive days
        for i in range(1, 14):
            check_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            if now.hour < 4:
                check_str = (now - timedelta(days=i+1)).strftime("%Y-%m-%d")

            if log_map.get(check_str):
                streak += 1
            else:
                break  # Streak ends

        # Calculate completion rate for last 7 days
        total_actions = 0
        completed_actions = 0

        for i in range(7):
            day_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            if now.hour < 4:
                day_str = (now - timedelta(days=i+1)).strftime("%Y-%m-%d")

            # Get daily actions
            actions_doc = plan_doc.reference.collection("dailyActions").document(day_str).get()
            if actions_doc.exists:
                actions_data = actions_doc.to_dict()
                actions = actions_data.get("actions", [])
                total_actions += len(actions)

            # Get completions
            log_doc = plan_doc.reference.collection("logs").document(day_str).get()
            if log_doc.exists:
                log_data = log_doc.to_dict()
                completed = log_data.get("completedActions", [])
                completed_actions += len(completed)

        completion_rate = completed_actions / total_actions if total_actions > 0 else 0.0

        return {
            "current_streak": streak,
            "plan_completion_rate": completion_rate
        }

    except Exception as e:
        print(f"Error analyzing plan activity: {e}")
        return {
            "current_streak": 0,
            "plan_completion_rate": 0.0
        }


async def analyze_tendency_scores(uid: str, db: firestore.Client) -> dict:
    """
    Analyze 4-axis tendency scores to identify weakest point
    Returns: { weakest_axis, weakest_score }
    """
    try:
        doc = db.collection("users").document(uid).collection("tendencyScores").document("latest").get()

        if not doc.exists:
            return {
                "weakest_axis": "stress",
                "weakest_score": 50
            }

        data = doc.to_dict()
        scores = {
            "hormone": data.get("hormonal", 50),
            "circadian": data.get("circadian", 50),
            "blood_flow": data.get("bloodCirculation", 50),
            "stress": data.get("stress", 50),
        }

        # Find weakest axis
        sorted_axes = sorted(scores.items(), key=lambda x: x[1])
        weakest_axis = sorted_axes[0][0] if sorted_axes else "stress"
        weakest_score = sorted_axes[0][1] if sorted_axes else 50

        return {
            "weakest_axis": weakest_axis,
            "weakest_score": weakest_score
        }

    except Exception as e:
        print(f"Error analyzing tendency scores: {e}")
        return {
            "weakest_axis": "stress",
            "weakest_score": 50
        }


async def analyze_user_activity(uid: str, db: firestore.Client) -> UserActivityMetrics:
    """
    Analyze all user activity data comprehensively

    Aggregates data from multiple Firestore collections in parallel:
    - photos: photo capture history
    - mealAnalysis: meal logging history
    - plans: plan completion status
    - tendencyScores: 4-axis scores

    Returns UserActivityMetrics with engagement level classification
    """
    # Execute all analyses in parallel for efficiency
    # Note: Using sequential calls instead of asyncio.gather() for now
    # as Firestore SDK is synchronous

    photo_data = await analyze_photo_activity(uid, db)
    meal_data = await analyze_meal_activity(uid, db)
    plan_data = await analyze_plan_activity(uid, db)
    score_data = await analyze_tendency_scores(uid, db)

    # Determine overall engagement level
    engagement_score = 0

    # Photo activity contribution (0-3 points)
    if photo_data["photo_frequency"] == "regular":
        engagement_score += 3
    elif photo_data["photo_frequency"] == "sporadic":
        engagement_score += 1

    # Meal logging contribution (0-3 points)
    if meal_data["meals_logged_last_week"] >= 7:
        engagement_score += 3
    elif meal_data["meals_logged_last_week"] >= 3:
        engagement_score += 2
    elif meal_data["meals_logged_last_week"] >= 1:
        engagement_score += 1

    # Plan completion contribution (0-4 points)
    if plan_data["current_streak"] >= 7:
        engagement_score += 4
    elif plan_data["current_streak"] >= 3:
        engagement_score += 3
    elif plan_data["current_streak"] >= 1:
        engagement_score += 2
    elif plan_data["plan_completion_rate"] > 0:
        engagement_score += 1

    # Classify engagement level (0-10 scale)
    if engagement_score >= 7:
        engagement_level = "high"
    elif engagement_score >= 3:
        engagement_level = "medium"
    else:
        engagement_level = "low"

    metrics: UserActivityMetrics = {
        **photo_data,
        **meal_data,
        **plan_data,
        **score_data,
        "engagement_level": engagement_level
    }

    return metrics
