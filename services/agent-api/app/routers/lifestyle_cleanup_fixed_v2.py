# ---------------------------------------------------------------------------
# Fixed version v2 of cleanup_user_data endpoint
# Addresses issues found in Codex review:
# - Infinite loop risk in batch delete
# - list_documents compatibility issue
# - Failed status logic
# ---------------------------------------------------------------------------

def _batch_delete_collection(db, collection_ref, batch_size: int = 500, max_retries: int = 3) -> tuple[int, bool]:
    """
    Delete all documents in a collection using batch writes with pagination.
    Avoids loading all documents into memory at once.

    Args:
        db: Firestore client
        collection_ref: Collection reference to delete
        batch_size: Number of documents to delete per batch (max 500 for Firestore)
        max_retries: Maximum number of retries for failed batches

    Returns:
        tuple: (number of documents deleted, success flag)
               success is False if any batch failed after max_retries
    """
    deleted_count = 0
    has_error = False

    while True:
        # Use select([]) to get only document references without field data
        # This is more efficient and compatible across SDK versions
        docs = list(collection_ref.limit(batch_size).select([]).stream())
        if not docs:
            break

        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)

        # Retry logic for batch commit
        commit_success = False
        for retry in range(max_retries):
            try:
                batch.commit()
                deleted_count += len(docs)
                logging.info(f"Deleted batch of {len(docs)} documents")
                commit_success = True
                break
            except Exception as e:
                logging.error(f"Batch commit failed (attempt {retry + 1}/{max_retries}): {e}", exc_info=True)
                if retry == max_retries - 1:
                    # Final retry failed
                    logging.error(f"Batch commit failed after {max_retries} retries, skipping this batch")
                    has_error = True
                    # Break the while loop to avoid infinite loop
                    return deleted_count, False

        if not commit_success:
            has_error = True
            # Break to avoid infinite loop
            break

        # If we got fewer docs than batch_size, we're done
        if len(docs) < batch_size:
            break

    return deleted_count, not has_error


@router.post("/cleanup-user-data")
@limiter.limit("5/minute")
def cleanup_user_data(
    request: Request,
    uid: str = Depends(get_current_uid)
):
    """
    Delete read-only collections that cannot be deleted from client (firestore.rules).
    Called during user account deletion to ensure complete data removal.

    Deletes:
    - dailyMissions: Generated missions (allow write: if false)
    - chatTasks: Chat-related tasks (allow write: if false)
    - quickActions: Quick action cache
    - quickQA: Quick Q&A cache
    - motivationMessages: Motivation message cache
    - mealAnalysis: Meal analysis cache
    - chatSettings: Chat settings
    - foodRequests/{uid}/items: Food recommendation items (top-level collection)
    - foodRequests/{uid}/recipes: Food recommendation recipes (top-level collection)
    - reports/{uid}/items: Weekly reports (top-level collection)

    Returns:
        Dict with deletion summary
    """
    db = get_firestore_client()
    deleted_collections = []
    errors = []  # Always initialize as list, never None
    total_operations = 0  # Track total number of operations for status determination

    # Delete dailyMissions collection (using batch delete for better performance)
    total_operations += 1
    try:
        missions_ref = db.collection("users").document(uid).collection("dailyMissions")
        deleted_count, success = _batch_delete_collection(db, missions_ref)

        if not success:
            errors.append("dailyMissions")
            logging.warning(f"dailyMissions deletion had errors for user {uid}")
        elif deleted_count > 0:
            deleted_collections.append(f"dailyMissions ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} dailyMissions documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete dailyMissions for user {uid}: {e}", exc_info=True)
        errors.append("dailyMissions")

    # Delete chatTasks collection (using batch delete for better performance)
    total_operations += 1
    try:
        tasks_ref = db.collection("users").document(uid).collection("chatTasks")
        deleted_count, success = _batch_delete_collection(db, tasks_ref)

        if not success:
            errors.append("chatTasks")
            logging.warning(f"chatTasks deletion had errors for user {uid}")
        elif deleted_count > 0:
            deleted_collections.append(f"chatTasks ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} chatTasks documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete chatTasks for user {uid}: {e}", exc_info=True)
        errors.append("chatTasks")

    # Delete quickActions collection (using batch delete for better performance)
    total_operations += 1
    try:
        quick_actions_ref = db.collection("users").document(uid).collection("quickActions")
        deleted_count, success = _batch_delete_collection(db, quick_actions_ref)

        if not success:
            errors.append("quickActions")
            logging.warning(f"quickActions deletion had errors for user {uid}")
        elif deleted_count > 0:
            deleted_collections.append(f"quickActions ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} quickActions documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete quickActions for user {uid}: {e}", exc_info=True)
        errors.append("quickActions")

    # Delete quickQA collection (using batch delete for better performance)
    total_operations += 1
    try:
        quick_qa_ref = db.collection("users").document(uid).collection("quickQA")
        deleted_count, success = _batch_delete_collection(db, quick_qa_ref)

        if not success:
            errors.append("quickQA")
            logging.warning(f"quickQA deletion had errors for user {uid}")
        elif deleted_count > 0:
            deleted_collections.append(f"quickQA ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} quickQA documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete quickQA for user {uid}: {e}", exc_info=True)
        errors.append("quickQA")

    # Delete motivationMessages collection (using batch delete for better performance)
    total_operations += 1
    try:
        motivation_ref = db.collection("users").document(uid).collection("motivationMessages")
        deleted_count, success = _batch_delete_collection(db, motivation_ref)

        if not success:
            errors.append("motivationMessages")
            logging.warning(f"motivationMessages deletion had errors for user {uid}")
        elif deleted_count > 0:
            deleted_collections.append(f"motivationMessages ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} motivationMessages documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete motivationMessages for user {uid}: {e}", exc_info=True)
        errors.append("motivationMessages")

    # Delete mealAnalysis collection (using batch delete for better performance)
    total_operations += 1
    try:
        meal_ref = db.collection("users").document(uid).collection("mealAnalysis")
        deleted_count, success = _batch_delete_collection(db, meal_ref)

        if not success:
            errors.append("mealAnalysis")
            logging.warning(f"mealAnalysis deletion had errors for user {uid}")
        elif deleted_count > 0:
            deleted_collections.append(f"mealAnalysis ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} mealAnalysis documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete mealAnalysis for user {uid}: {e}", exc_info=True)
        errors.append("mealAnalysis")

    # Delete chatSettings collection (using batch delete for better performance)
    total_operations += 1
    try:
        settings_ref = db.collection("users").document(uid).collection("chatSettings")
        deleted_count, success = _batch_delete_collection(db, settings_ref)

        if not success:
            errors.append("chatSettings")
            logging.warning(f"chatSettings deletion had errors for user {uid}")
        elif deleted_count > 0:
            deleted_collections.append(f"chatSettings ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} chatSettings documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete chatSettings for user {uid}: {e}", exc_info=True)
        errors.append("chatSettings")

    # Delete food recommendations from new location: users/{uid}/foodRecommendations (current standard)
    total_operations += 1
    try:
        new_food_recs_ref = db.collection("users").document(uid).collection("foodRecommendations")
        deleted_count, success = _batch_delete_collection(db, new_food_recs_ref)

        if not success:
            errors.append(f"users/{uid}/foodRecommendations")
            logging.warning(f"users/{uid}/foodRecommendations deletion had errors for user {uid}")
        elif deleted_count > 0:
            deleted_collections.append(f"users/{uid}/foodRecommendations ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} users/{uid}/foodRecommendations documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete users/{uid}/foodRecommendations for user {uid}: {e}", exc_info=True)
        errors.append(f"users/{uid}/foodRecommendations")

    # Delete food recommendations from old location: foodRequests/{uid}/items (legacy)
    total_operations += 1
    try:
        old_food_items_ref = db.collection("foodRequests").document(uid).collection("items")
        deleted_count, success = _batch_delete_collection(db, old_food_items_ref)

        if not success:
            errors.append(f"foodRequests/{uid}/items (legacy)")
            logging.warning(f"foodRequests/{uid}/items (legacy) deletion had errors for user {uid}")
        elif deleted_count > 0:
            deleted_collections.append(f"foodRequests/{uid}/items (legacy) ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} foodRequests/{uid}/items (legacy) documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete foodRequests/{uid}/items (legacy) for user {uid}: {e}", exc_info=True)
        errors.append(f"foodRequests/{uid}/items (legacy)")

    # Delete food recipes from new location: users/{uid}/foodRecipes (current standard)
    total_operations += 1
    try:
        new_food_recipes_ref = db.collection("users").document(uid).collection("foodRecipes")
        deleted_count, success = _batch_delete_collection(db, new_food_recipes_ref)

        if not success:
            errors.append(f"users/{uid}/foodRecipes")
            logging.warning(f"users/{uid}/foodRecipes deletion had errors for user {uid}")
        elif deleted_count > 0:
            deleted_collections.append(f"users/{uid}/foodRecipes ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} users/{uid}/foodRecipes documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete users/{uid}/foodRecipes for user {uid}: {e}", exc_info=True)
        errors.append(f"users/{uid}/foodRecipes")

    # Delete food recipes from old location: foodRequests/{uid}/recipes (legacy)
    total_operations += 1
    try:
        old_food_recipes_ref = db.collection("foodRequests").document(uid).collection("recipes")
        deleted_count, success = _batch_delete_collection(db, old_food_recipes_ref)

        if not success:
            errors.append(f"foodRequests/{uid}/recipes (legacy)")
            logging.warning(f"foodRequests/{uid}/recipes (legacy) deletion had errors for user {uid}")
        elif deleted_count > 0:
            deleted_collections.append(f"foodRequests/{uid}/recipes (legacy) ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} foodRequests/{uid}/recipes (legacy) documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete foodRequests/{uid}/recipes (legacy) for user {uid}: {e}", exc_info=True)
        errors.append(f"foodRequests/{uid}/recipes (legacy)")

    # Delete reports from new location: users/{uid}/reports (current standard)
    total_operations += 1
    try:
        new_reports_ref = db.collection("users").document(uid).collection("reports")
        deleted_count, success = _batch_delete_collection(db, new_reports_ref)

        if not success:
            errors.append(f"users/{uid}/reports")
            logging.warning(f"users/{uid}/reports deletion had errors for user {uid}")
        elif deleted_count > 0:
            deleted_collections.append(f"users/{uid}/reports ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} users/{uid}/reports documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete users/{uid}/reports for user {uid}: {e}", exc_info=True)
        errors.append(f"users/{uid}/reports")

    # Delete reports from old location: reports/{uid}/items (legacy)
    total_operations += 1
    try:
        old_reports_ref = db.collection("reports").document(uid).collection("items")
        deleted_count, success = _batch_delete_collection(db, old_reports_ref)

        if not success:
            errors.append(f"reports/{uid}/items (legacy)")
            logging.warning(f"reports/{uid}/items (legacy) deletion had errors for user {uid}")
        elif deleted_count > 0:
            deleted_collections.append(f"reports/{uid}/items (legacy) ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} reports/{uid}/items (legacy) documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete reports/{uid}/items (legacy) for user {uid}: {e}", exc_info=True)
        errors.append(f"reports/{uid}/items (legacy)")

    # Delete parent document reports/{uid} (GDPR compliance)
    total_operations += 1
    try:
        db.collection("reports").document(uid).delete()
        deleted_collections.append(f"reports/{uid} (parent doc)")
        logging.info(f"Deleted parent document reports/{uid}")
    except Exception as e:
        logging.error(f"Failed to delete reports/{uid} parent document: {e}", exc_info=True)
        errors.append(f"reports/{uid} (parent doc)")

    # Delete parent document foodRequests/{uid} (GDPR compliance)
    total_operations += 1
    try:
        db.collection("foodRequests").document(uid).delete()
        deleted_collections.append(f"foodRequests/{uid} (parent doc)")
        logging.info(f"Deleted parent document foodRequests/{uid}")
    except Exception as e:
        logging.error(f"Failed to delete foodRequests/{uid} parent document: {e}", exc_info=True)
        errors.append(f"foodRequests/{uid} (parent doc)")

    # Determine status based on errors and total operations
    if not errors:
        status = "completed"
    elif len(errors) == total_operations:  # All operations failed
        status = "failed"
    else:
        status = "partial_success"

    # Return summary
    return {
        "status": status,
        "deleted": deleted_collections,
        "errors": errors,  # Always return list, even if empty
        "timestamp": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat()
    }
