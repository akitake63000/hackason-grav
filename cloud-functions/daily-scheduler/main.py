"""
Cloud Function: Daily Auto-Confirm & Action Generation
Triggered at 4:00 AM JST every day by Cloud Scheduler

Functions:
1. Auto-confirm yesterday's logs for all users
2. Generate today's actions for all users based on their tendency scores
"""

import functions_framework
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import logging
from typing import Dict, Any

# Import shared modules (copied from agent-api)
from shared.generate_plan import generate_daily_actions
from shared.firebase_client import init_firebase, get_firestore_client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

JST = ZoneInfo("Asia/Tokyo")


@functions_framework.http
def daily_scheduler(request):
    """
    HTTP Cloud Function entry point
    Called by Cloud Scheduler at 4 AM JST daily
    """
    try:
        # Initialize Firebase
        init_firebase()
        db = get_firestore_client()

        # Get JST times
        now_jst = datetime.now(JST)
        yesterday = (now_jst - timedelta(days=1)).strftime("%Y-%m-%d")
        today = now_jst.strftime("%Y-%m-%d")

        logger.info(f"Starting daily scheduler at {now_jst.isoformat()}")
        logger.info(f"Yesterday: {yesterday}, Today: {today}")

        # Step 1: Auto-confirm yesterday's logs
        confirmed_count = auto_confirm_yesterday_logs(db, yesterday)

        # Step 2: Generate today's actions
        generated_count = generate_today_actions(db, today)

        result = {
            "status": "success",
            "timestamp": now_jst.isoformat(),
            "yesterday": yesterday,
            "today": today,
            "confirmed_logs": confirmed_count,
            "generated_actions": generated_count
        }

        logger.info(f"Daily scheduler completed: {result}")
        return result

    except Exception as e:
        logger.error(f"Error in daily scheduler: {e}", exc_info=True)
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now(JST).isoformat()
        }, 500


def auto_confirm_yesterday_logs(db, yesterday: str) -> int:
    """
    Auto-confirm yesterday's logs for all users

    Firestore structure:
    users/{uid}/plans/{planId}/logs/{YYYY-MM-DD}
    - isConfirmed: bool
    - completedActions: list
    """
    confirmed_count = 0

    try:
        # Get all users
        users_ref = db.collection("users")
        users = users_ref.stream()

        for user_doc in users:
            uid = user_doc.id

            try:
                # Get all plans for this user (not filtering by status to handle edge cases)
                plans_ref = users_ref.document(uid).collection("plans")
                plans = plans_ref.stream()

                for plan_doc in plans:
                    plan_id = plan_doc.id

                    # Check yesterday's log
                    log_ref = plans_ref.document(plan_id).collection("logs").document(yesterday)
                    log_doc = log_ref.get()

                    if log_doc.exists:
                        log_data = log_doc.to_dict()

                        # Only confirm if not already confirmed
                        if not log_data.get("isConfirmed", False):
                            log_ref.update({
                                "isConfirmed": True,
                                "autoConfirmedAt": datetime.now(JST).isoformat(),
                                "updatedAt": datetime.now(JST).isoformat()
                            })
                            confirmed_count += 1
                            logger.info(f"Confirmed log for user={uid}, plan={plan_id}, date={yesterday}")
                    else:
                        # Create empty log if doesn't exist (user had no activity yesterday)
                        log_ref.set({
                            "completedActions": [],
                            "isConfirmed": True,
                            "autoConfirmedAt": datetime.now(JST).isoformat(),
                            "createdAt": datetime.now(JST).isoformat()
                        })
                        confirmed_count += 1
                        logger.info(f"Created and confirmed empty log for user={uid}, plan={plan_id}, date={yesterday}")

            except Exception as e:
                logger.error(f"Error confirming logs for user={uid}: {e}")
                continue

        logger.info(f"Auto-confirmed {confirmed_count} logs")
        return confirmed_count

    except Exception as e:
        logger.error(f"Error in auto_confirm_yesterday_logs: {e}", exc_info=True)
        raise


def generate_today_actions(db, today: str) -> int:
    """
    Generate today's actions for all users based on their tendency scores

    Firestore structure:
    users/{uid}/tendencyScores/latest - scores and answers
    users/{uid}/plans/{planId}/dailyActions/{YYYY-MM-DD} - generated actions
    """
    generated_count = 0

    try:
        # Get all users
        users_ref = db.collection("users")
        users = users_ref.stream()

        for user_doc in users:
            uid = user_doc.id

            try:
                # Get user's latest tendency scores
                tendency_ref = users_ref.document(uid).collection("tendencyScores").document("latest")
                tendency_doc = tendency_ref.get()

                if not tendency_doc.exists:
                    logger.info(f"No tendency scores found for user={uid}, skipping")
                    continue

                tendency_data = tendency_doc.to_dict()

                # Extract scores with correct key names
                # Firestore stores: hormonal, bloodCirculation, circadian, stress
                # Function expects: hormone, blood_flow, circadian, stress
                scores = {
                    "hormone": tendency_data.get("hormonal", 50),
                    "blood_flow": tendency_data.get("bloodCirculation", 50),
                    "circadian": tendency_data.get("circadian", 50),
                    "stress": tendency_data.get("stress", 50)
                }
                answers = tendency_data.get("answers", {})

                if not scores:
                    logger.info(f"Empty scores for user={uid}, skipping")
                    continue

                # Get all plans for this user
                plans_ref = users_ref.document(uid).collection("plans")
                plans = plans_ref.stream()

                for plan_doc in plans:
                    plan_id = plan_doc.id
                    plan_data = plan_doc.to_dict()

                    # Check if plan is active (within date range)
                    start_date = plan_data.get("startDate", "")
                    end_date = plan_data.get("endDate", "")

                    if not is_plan_active(today, start_date, end_date):
                        continue

                    # Check if today's actions already exist
                    actions_ref = plans_ref.document(plan_id).collection("dailyActions").document(today)
                    actions_doc = actions_ref.get()

                    if actions_doc.exists:
                        logger.info(f"Actions already exist for user={uid}, plan={plan_id}, date={today}")
                        continue

                    # Generate actions using existing logic
                    actions = generate_daily_actions(scores, answers)

                    # Save to Firestore
                    actions_ref.set({
                        "actions": actions,
                        "generatedAt": datetime.now(JST).isoformat(),
                        "autoGenerated": True
                    })

                    generated_count += 1
                    logger.info(f"Generated {len(actions)} actions for user={uid}, plan={plan_id}, date={today}")

            except Exception as e:
                logger.error(f"Error generating actions for user={uid}: {e}")
                continue

        logger.info(f"Generated actions for {generated_count} plans")
        return generated_count

    except Exception as e:
        logger.error(f"Error in generate_today_actions: {e}", exc_info=True)
        raise


def is_plan_active(check_date: str, start_date: str, end_date: str) -> bool:
    """Check if a plan is active on the given date"""
    try:
        check = datetime.fromisoformat(check_date.replace("Z", "+00:00"))
        start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        return start <= check <= end
    except Exception:
        return False
