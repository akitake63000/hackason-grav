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
import os
from typing import Dict, Any

# Import shared modules (copied from agent-api)
from shared.generate_plan import generate_daily_actions
from shared.firebase_client import init_firebase, get_firestore_client

# Import for OIDC verification
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

JST = ZoneInfo("Asia/Tokyo")

# Allowed service accounts (from environment variable)
# Format: comma-separated list of service account emails
ALLOWED_SA_EMAILS = set(
    email.strip()
    for email in os.getenv("SCHEDULER_SA_EMAIL", "").split(",")
    if email.strip()
)


def _verify_scheduler_auth(request) -> bool:
    """
    Verify that the request is from an allowed Cloud Scheduler service account.

    Args:
        request: The HTTP request object

    Returns:
        True if authorized, False otherwise
    """
    # Skip auth check if no allowed service accounts are configured
    # (for development/testing environments)
    if not ALLOWED_SA_EMAILS:
        logger.warning("No SCHEDULER_SA_EMAIL configured, skipping auth check")
        return True

    # Extract Authorization header
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        logger.warning("Missing or invalid Authorization header")
        return False

    # Extract token
    token = auth_header.split(" ", 1)[1]

    try:
        # Verify OIDC token
        # The audience should be the Cloud Function URL
        audience = os.getenv("SCHEDULER_AUDIENCE")
        if not audience:
            logger.error("SCHEDULER_AUDIENCE environment variable not set")
            return False

        # Verify token and get claims
        claims = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            audience=audience,
        )

        # Check if the email is in the allowed list
        email = claims.get("email", "")
        if email in ALLOWED_SA_EMAILS:
            logger.info(f"Authorized request from service account: {email}")
            return True
        else:
            logger.warning(f"Unauthorized service account: {email}")
            return False

    except ValueError as e:
        logger.error(f"Token verification failed: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error during auth verification: {e}", exc_info=True)
        return False


@functions_framework.http
def daily_scheduler(request):
    """
    HTTP Cloud Function entry point
    Called by Cloud Scheduler at 4 AM JST daily

    Security: Requires OIDC authentication from Cloud Scheduler service account
    """
    # Verify authentication
    if not _verify_scheduler_auth(request):
        logger.error("Unauthorized request to daily scheduler")
        return {"status": "error", "error": "Unauthorized"}, 401

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
            "error": "スケジューラーの実行中にエラーが発生しました",
            "timestamp": datetime.now(JST).isoformat()
        }, 500


def auto_confirm_yesterday_logs(db, yesterday: str) -> int:
    """
    Auto-confirm yesterday's logs for all users

    Firestore structure:
    users/{uid}/plans/{planId}/logs/{YYYY-MM-DD}
    - isConfirmed: bool
    - completedActions: list

    Performance optimization:
    - Uses batch writes to reduce API calls
    - Reduced logging for better performance
    - Early termination on safety limits
    """
    confirmed_count = 0
    processed_users = 0
    MAX_USERS_PER_RUN = 10000  # Safety limit to prevent timeout
    BATCH_SIZE = 500  # Firestore batch write limit

    try:
        # Get all users
        users_ref = db.collection("users")
        users = users_ref.stream()

        # Batch for write operations
        batch = db.batch()
        batch_count = 0

        for user_doc in users:
            uid = user_doc.id
            processed_users += 1

            # Safety limit to prevent Cloud Function timeout
            if processed_users > MAX_USERS_PER_RUN:
                logger.warning(f"Reached max users limit ({MAX_USERS_PER_RUN}), stopping processing")
                break

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
                            batch.update(log_ref, {
                                "isConfirmed": True,
                                "autoConfirmedAt": datetime.now(JST).isoformat(),
                                "updatedAt": datetime.now(JST).isoformat()
                            })
                            batch_count += 1
                            confirmed_count += 1
                    else:
                        # Create empty log if doesn't exist (user had no activity yesterday)
                        batch.set(log_ref, {
                            "completedActions": [],
                            "isConfirmed": True,
                            "autoConfirmedAt": datetime.now(JST).isoformat(),
                            "createdAt": datetime.now(JST).isoformat()
                        })
                        batch_count += 1
                        confirmed_count += 1

                    # Commit batch when reaching limit
                    if batch_count >= BATCH_SIZE:
                        batch.commit()
                        logger.info(f"Committed batch of {batch_count} log confirmations")
                        batch = db.batch()
                        batch_count = 0

            except Exception as e:
                logger.error(f"Error confirming logs for user={uid}: {e}")
                continue

        # Commit remaining batch
        if batch_count > 0:
            batch.commit()
            logger.info(f"Committed final batch of {batch_count} log confirmations")

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

    Performance optimization:
    - Uses batch writes to reduce API calls
    - Reduced logging for better performance
    - Early termination on safety limits
    - Skips users without tendency scores early
    """
    generated_count = 0
    processed_users = 0
    MAX_USERS_PER_RUN = 10000  # Safety limit to prevent timeout
    BATCH_SIZE = 500  # Firestore batch write limit

    try:
        # Get all users
        users_ref = db.collection("users")
        users = users_ref.stream()

        # Batch for write operations
        batch = db.batch()
        batch_count = 0

        for user_doc in users:
            uid = user_doc.id
            processed_users += 1

            # Safety limit to prevent Cloud Function timeout
            if processed_users > MAX_USERS_PER_RUN:
                logger.warning(f"Reached max users limit ({MAX_USERS_PER_RUN}), stopping processing")
                break

            try:
                # Get user's latest tendency scores
                tendency_ref = users_ref.document(uid).collection("tendencyScores").document("latest")
                tendency_doc = tendency_ref.get()

                if not tendency_doc.exists:
                    # Skip logging for users without scores to reduce noise
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
                        continue

                    # Generate actions using existing logic
                    actions = generate_daily_actions(scores, answers)

                    # Add to batch
                    batch.set(actions_ref, {
                        "actions": actions,
                        "generatedAt": datetime.now(JST).isoformat(),
                        "autoGenerated": True
                    })
                    batch_count += 1
                    generated_count += 1

                    # Commit batch when reaching limit
                    if batch_count >= BATCH_SIZE:
                        batch.commit()
                        logger.info(f"Committed batch of {batch_count} action generations")
                        batch = db.batch()
                        batch_count = 0

            except Exception as e:
                logger.error(f"Error generating actions for user={uid}: {e}")
                continue

        # Commit remaining batch
        if batch_count > 0:
            batch.commit()
            logger.info(f"Committed final batch of {batch_count} action generations")

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
