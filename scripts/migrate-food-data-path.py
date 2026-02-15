#!/usr/bin/env python3
"""
Migrate food recommendations and recipes data from old location to new location.

Old locations:
- foodRequests/{uid}/items/{itemId}
- foodRequests/{uid}/recipes/{recipeId}

New locations:
- users/{uid}/foodRecommendations/{itemId}
- users/{uid}/foodRecipes/{recipeId}

This script safely migrates all existing food data to the new location without deleting the old data.
After migration is verified, you can manually delete the old location if needed.
"""

import firebase_admin
from firebase_admin import credentials, firestore
import logging
from typing import Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def init_firebase():
    """Initialize Firebase Admin SDK"""
    if not firebase_admin._apps:
        # Initialize with default credentials (uses GOOGLE_APPLICATION_CREDENTIALS env var)
        firebase_admin.initialize_app()
    return firestore.client()


def migrate_food_recommendations(db: firestore.Client, dry_run: bool = True):
    """
    Migrate food recommendations from old location to new location.

    Args:
        db: Firestore client
        dry_run: If True, only log what would be migrated without actually migrating
    """
    logger.info(f"Starting food recommendations migration (dry_run={dry_run})")

    # Get all user IDs from old foodRequests collection
    old_food_requests_collection = db.collection("foodRequests")
    user_docs = old_food_requests_collection.stream()

    migrated_count = 0
    skipped_count = 0
    error_count = 0

    for user_doc in user_docs:
        uid = user_doc.id
        logger.info(f"Processing user: {uid}")

        try:
            # Get all items for this user from old location
            old_items_ref = old_food_requests_collection.document(uid).collection("items")
            old_items = old_items_ref.stream()

            for item_doc in old_items:
                item_id = item_doc.id
                item_data = item_doc.to_dict()

                # Check if item already exists in new location
                new_item_ref = db.collection("users").document(uid).collection("foodRecommendations").document(item_id)
                new_item_doc = new_item_ref.get()

                if new_item_doc.exists:
                    logger.info(f"  Item {item_id} already exists in new location, skipping")
                    skipped_count += 1
                    continue

                if dry_run:
                    logger.info(f"  [DRY RUN] Would migrate item {item_id}")
                    logger.info(f"    From: foodRequests/{uid}/items/{item_id}")
                    logger.info(f"    To:   users/{uid}/foodRecommendations/{item_id}")
                    logger.info(f"    Data: {list(item_data.keys())}")
                else:
                    # Migrate item to new location
                    new_item_ref.set(item_data)
                    logger.info(f"  Migrated item {item_id}")

                migrated_count += 1

        except Exception as e:
            logger.error(f"Error processing user {uid} items: {e}", exc_info=True)
            error_count += 1
            continue

    logger.info("="*60)
    logger.info(f"Food recommendations migration complete:")
    logger.info(f"  Migrated: {migrated_count}")
    logger.info(f"  Skipped (already exists): {skipped_count}")
    logger.info(f"  Errors: {error_count}")
    logger.info("="*60)


def migrate_food_recipes(db: firestore.Client, dry_run: bool = True):
    """
    Migrate food recipes from old location to new location.

    Args:
        db: Firestore client
        dry_run: If True, only log what would be migrated without actually migrating
    """
    logger.info(f"Starting food recipes migration (dry_run={dry_run})")

    # Get all user IDs from old foodRequests collection
    old_food_requests_collection = db.collection("foodRequests")
    user_docs = old_food_requests_collection.stream()

    migrated_count = 0
    skipped_count = 0
    error_count = 0

    for user_doc in user_docs:
        uid = user_doc.id
        logger.info(f"Processing user: {uid}")

        try:
            # Get all recipes for this user from old location
            old_recipes_ref = old_food_requests_collection.document(uid).collection("recipes")
            old_recipes = old_recipes_ref.stream()

            for recipe_doc in old_recipes:
                recipe_id = recipe_doc.id
                recipe_data = recipe_doc.to_dict()

                # Check if recipe already exists in new location
                new_recipe_ref = db.collection("users").document(uid).collection("foodRecipes").document(recipe_id)
                new_recipe_doc = new_recipe_ref.get()

                if new_recipe_doc.exists:
                    logger.info(f"  Recipe {recipe_id} already exists in new location, skipping")
                    skipped_count += 1
                    continue

                if dry_run:
                    logger.info(f"  [DRY RUN] Would migrate recipe {recipe_id}")
                    logger.info(f"    From: foodRequests/{uid}/recipes/{recipe_id}")
                    logger.info(f"    To:   users/{uid}/foodRecipes/{recipe_id}")
                    logger.info(f"    Data: {list(recipe_data.keys())}")
                else:
                    # Migrate recipe to new location
                    new_recipe_ref.set(recipe_data)
                    logger.info(f"  Migrated recipe {recipe_id}")

                migrated_count += 1

        except Exception as e:
            logger.error(f"Error processing user {uid} recipes: {e}", exc_info=True)
            error_count += 1
            continue

    logger.info("="*60)
    logger.info(f"Food recipes migration complete:")
    logger.info(f"  Migrated: {migrated_count}")
    logger.info(f"  Skipped (already exists): {skipped_count}")
    logger.info(f"  Errors: {error_count}")
    logger.info("="*60)


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Migrate food data to new Firestore location")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Execute the migration (default is dry-run mode)"
    )
    parser.add_argument(
        "--only",
        choices=["recommendations", "recipes"],
        help="Migrate only recommendations or recipes (default: both)"
    )
    args = parser.parse_args()

    db = init_firebase()

    logger.info("="*60)
    logger.info("Food Data Migration Script")
    logger.info("="*60)
    logger.info(f"Mode: {'EXECUTE' if args.execute else 'DRY RUN'}")
    logger.info("")

    if args.only == "recommendations" or not args.only:
        migrate_food_recommendations(db, dry_run=not args.execute)
        logger.info("")

    if args.only == "recipes" or not args.only:
        migrate_food_recipes(db, dry_run=not args.execute)

    if not args.execute:
        logger.info("\nThis was a DRY RUN. No data was actually migrated.")
        logger.info("Run with --execute flag to perform actual migration.")


if __name__ == "__main__":
    main()
