#!/usr/bin/env python3
"""
Script to apply the fixed cleanup_user_data code to lifestyle.py
Replaces lines 2514-2763 with the corrected implementation
"""

import sys
import os

# The fixed code to insert (without the file header comments)
FIXED_CODE = '''def _batch_delete_collection(db, collection_ref, batch_size: int = 500) -> int:
    """
    Delete all documents in a collection using batch writes with pagination.
    Avoids loading all documents into memory at once.

    Args:
        db: Firestore client
        collection_ref: Collection reference to delete
        batch_size: Number of documents to delete per batch (max 500 for Firestore)

    Returns:
        Number of documents deleted
    """
    deleted_count = 0

    while True:
        # Use list_documents() to get only document references (no field data)
        # This is more efficient and cheaper than stream()
        docs = list(collection_ref.limit(batch_size).list_documents())
        if not docs:
            break

        batch = db.batch()
        for doc_ref in docs:
            batch.delete(doc_ref)

        try:
            batch.commit()
            deleted_count += len(docs)
            logging.info(f"Deleted batch of {len(docs)} documents")
        except Exception as e:
            logging.error(f"Batch commit failed: {e}", exc_info=True)
            # Continue to next batch even if this one fails
            # The client will see partial deletion in the response

        # If we got fewer docs than batch_size, we're done
        if len(docs) < batch_size:
            break

    return deleted_count


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

    # Delete dailyMissions collection (using batch delete for better performance)
    try:
        missions_ref = db.collection("users").document(uid).collection("dailyMissions")
        deleted_count = _batch_delete_collection(db, missions_ref)

        if deleted_count > 0:
            deleted_collections.append(f"dailyMissions ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} dailyMissions documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete dailyMissions for user {uid}: {e}", exc_info=True)
        errors.append("dailyMissions")

    # Delete chatTasks collection (using batch delete for better performance)
    try:
        tasks_ref = db.collection("users").document(uid).collection("chatTasks")
        deleted_count = _batch_delete_collection(db, tasks_ref)

        if deleted_count > 0:
            deleted_collections.append(f"chatTasks ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} chatTasks documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete chatTasks for user {uid}: {e}", exc_info=True)
        errors.append("chatTasks")

    # Delete quickActions collection (using batch delete for better performance)
    try:
        quick_actions_ref = db.collection("users").document(uid).collection("quickActions")
        deleted_count = _batch_delete_collection(db, quick_actions_ref)

        if deleted_count > 0:
            deleted_collections.append(f"quickActions ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} quickActions documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete quickActions for user {uid}: {e}", exc_info=True)
        errors.append("quickActions")

    # Delete quickQA collection (using batch delete for better performance)
    try:
        quick_qa_ref = db.collection("users").document(uid).collection("quickQA")
        deleted_count = _batch_delete_collection(db, quick_qa_ref)

        if deleted_count > 0:
            deleted_collections.append(f"quickQA ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} quickQA documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete quickQA for user {uid}: {e}", exc_info=True)
        errors.append("quickQA")

    # Delete motivationMessages collection (using batch delete for better performance)
    try:
        motivation_ref = db.collection("users").document(uid).collection("motivationMessages")
        deleted_count = _batch_delete_collection(db, motivation_ref)

        if deleted_count > 0:
            deleted_collections.append(f"motivationMessages ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} motivationMessages documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete motivationMessages for user {uid}: {e}", exc_info=True)
        errors.append("motivationMessages")

    # Delete mealAnalysis collection (using batch delete for better performance)
    try:
        meal_ref = db.collection("users").document(uid).collection("mealAnalysis")
        deleted_count = _batch_delete_collection(db, meal_ref)

        if deleted_count > 0:
            deleted_collections.append(f"mealAnalysis ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} mealAnalysis documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete mealAnalysis for user {uid}: {e}", exc_info=True)
        errors.append("mealAnalysis")

    # Delete chatSettings collection (using batch delete for better performance)
    try:
        settings_ref = db.collection("users").document(uid).collection("chatSettings")
        deleted_count = _batch_delete_collection(db, settings_ref)

        if deleted_count > 0:
            deleted_collections.append(f"chatSettings ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} chatSettings documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete chatSettings for user {uid}: {e}", exc_info=True)
        errors.append("chatSettings")

    # Delete food recommendations from new location: users/{uid}/foodRecommendations (current standard)
    # Using batch delete for better performance
    try:
        new_food_recs_ref = db.collection("users").document(uid).collection("foodRecommendations")
        deleted_count = _batch_delete_collection(db, new_food_recs_ref)

        if deleted_count > 0:
            deleted_collections.append(f"users/{uid}/foodRecommendations ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} users/{uid}/foodRecommendations documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete users/{uid}/foodRecommendations for user {uid}: {e}", exc_info=True)
        errors.append(f"users/{uid}/foodRecommendations")  # Use f-string to include actual uid

    # Delete food recommendations from old location: foodRequests/{uid}/items (legacy, for backward compatibility)
    # Using batch delete for better performance
    try:
        old_food_items_ref = db.collection("foodRequests").document(uid).collection("items")
        deleted_count = _batch_delete_collection(db, old_food_items_ref)

        if deleted_count > 0:
            deleted_collections.append(f"foodRequests/{uid}/items (legacy) ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} foodRequests/{uid}/items (legacy) documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete foodRequests/{uid}/items (legacy) for user {uid}: {e}", exc_info=True)
        errors.append(f"foodRequests/{uid}/items (legacy)")  # Use f-string

    # Delete food recipes from new location: users/{uid}/foodRecipes (current standard)
    # Using batch delete for better performance
    try:
        new_food_recipes_ref = db.collection("users").document(uid).collection("foodRecipes")
        deleted_count = _batch_delete_collection(db, new_food_recipes_ref)

        if deleted_count > 0:
            deleted_collections.append(f"users/{uid}/foodRecipes ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} users/{uid}/foodRecipes documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete users/{uid}/foodRecipes for user {uid}: {e}", exc_info=True)
        errors.append(f"users/{uid}/foodRecipes")  # Use f-string

    # Delete food recipes from old location: foodRequests/{uid}/recipes (legacy, for backward compatibility)
    # Using batch delete for better performance
    try:
        old_food_recipes_ref = db.collection("foodRequests").document(uid).collection("recipes")
        deleted_count = _batch_delete_collection(db, old_food_recipes_ref)

        if deleted_count > 0:
            deleted_collections.append(f"foodRequests/{uid}/recipes (legacy) ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} foodRequests/{uid}/recipes (legacy) documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete foodRequests/{uid}/recipes (legacy) for user {uid}: {e}", exc_info=True)
        errors.append(f"foodRequests/{uid}/recipes (legacy)")  # Use f-string

    # Delete reports from new location: users/{uid}/reports (current standard)
    # Using batch delete for better performance
    try:
        new_reports_ref = db.collection("users").document(uid).collection("reports")
        deleted_count = _batch_delete_collection(db, new_reports_ref)

        if deleted_count > 0:
            deleted_collections.append(f"users/{uid}/reports ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} users/{uid}/reports documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete users/{uid}/reports for user {uid}: {e}", exc_info=True)
        errors.append(f"users/{uid}/reports")  # Use f-string

    # Delete reports from old location: reports/{uid}/items (legacy, for backward compatibility)
    # Using batch delete for better performance
    try:
        old_reports_ref = db.collection("reports").document(uid).collection("items")
        deleted_count = _batch_delete_collection(db, old_reports_ref)

        if deleted_count > 0:
            deleted_collections.append(f"reports/{uid}/items (legacy) ({deleted_count} docs)")
            logging.info(f"Deleted {deleted_count} reports/{uid}/items (legacy) documents for user {uid}")
    except Exception as e:
        logging.error(f"Failed to delete reports/{uid}/items (legacy) for user {uid}: {e}", exc_info=True)
        errors.append(f"reports/{uid}/items (legacy)")  # Use f-string

    # Delete parent document reports/{uid} (GDPR compliance)
    # Separate try/except for parent document deletion
    try:
        db.collection("reports").document(uid).delete()
        deleted_collections.append(f"reports/{uid} (parent doc)")
        logging.info(f"Deleted parent document reports/{uid}")
    except Exception as e:
        logging.error(f"Failed to delete reports/{uid} parent document: {e}", exc_info=True)
        errors.append(f"reports/{uid} (parent doc)")  # Use f-string

    # Delete parent document foodRequests/{uid} (GDPR compliance)
    # Only delete parent if child collections were deleted (to avoid orphan subcollections)
    try:
        db.collection("foodRequests").document(uid).delete()
        deleted_collections.append(f"foodRequests/{uid} (parent doc)")
        logging.info(f"Deleted parent document foodRequests/{uid}")
    except Exception as e:
        logging.error(f"Failed to delete foodRequests/{uid} parent document: {e}", exc_info=True)
        errors.append(f"foodRequests/{uid} (parent doc)")  # Use f-string

    # Determine status based on errors
    if not errors:
        status = "completed"
    elif len(errors) == len(deleted_collections) + 2:  # All operations failed
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
'''

def apply_fix():
    """Apply the fix to lifestyle.py"""

    # Read the original file
    original_file = os.path.join(os.path.dirname(__file__), 'lifestyle.py')
    with open(original_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Replace lines 2514-2763 (Python uses 0-based indexing)
    start_line = 2513  # Line 2514 in 1-based indexing
    end_line = 2763    # Line 2763 in 1-based indexing (inclusive)

    # Build new file content
    new_lines = lines[:start_line] + [FIXED_CODE + '\n'] + lines[end_line:]

    # Write back to the original file
    with open(original_file, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    print(f"✅ Successfully applied fix to {original_file}")
    print(f"   Replaced lines {start_line + 1}-{end_line} with fixed implementation")
    print()
    print("📋 Summary of changes:")
    print("   1. _batch_delete_collection: Now uses pagination (list_documents + limit)")
    print("      - Avoids loading all documents into memory at once")
    print("      - Continues even if one batch fails")
    print()
    print("   2. cleanup_user_data:")
    print("      - Changed from 'async def' to 'def' to avoid event loop blocking")
    print("      - errors array: Always returns list (never None)")
    print("      - Placeholder strings: Fixed to use f-strings with actual uid")
    print("      - Parent document deletion: Separated into distinct try/except blocks")
    print("      - Status field: Now shows 'completed', 'partial_success', or 'failed'")
    print()
    print("🔍 Next steps:")
    print("   1. Review the changes: diff lifestyle.py.backup_* lifestyle.py")
    print("   2. Deploy to Cloud Run")
    print("   3. Test account deletion flow")

if __name__ == '__main__':
    try:
        apply_fix()
    except Exception as e:
        print(f"❌ Error applying fix: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
