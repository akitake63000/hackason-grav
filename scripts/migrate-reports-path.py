#!/usr/bin/env python3
"""
Migrate reports data from old location to new location.

Old location: reports/{uid}/items/{reportId}
New location: users/{uid}/reports/{reportId}

This script safely migrates all existing reports to the new location without deleting the old data.
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


def migrate_reports(db: firestore.Client, dry_run: bool = True):
    """
    Migrate reports from old location to new location.

    Args:
        db: Firestore client
        dry_run: If True, only log what would be migrated without actually migrating
    """
    logger.info(f"Starting reports migration (dry_run={dry_run})")

    # Get all user IDs from old reports collection
    old_reports_collection = db.collection("reports")
    user_docs = old_reports_collection.stream()

    migrated_count = 0
    skipped_count = 0
    error_count = 0

    for user_doc in user_docs:
        uid = user_doc.id
        logger.info(f"Processing user: {uid}")

        try:
            # Get all reports for this user from old location
            old_reports_ref = old_reports_collection.document(uid).collection("items")
            old_reports = old_reports_ref.stream()

            for report_doc in old_reports:
                report_id = report_doc.id
                report_data = report_doc.to_dict()

                # Check if report already exists in new location
                new_report_ref = db.collection("users").document(uid).collection("reports").document(report_id)
                new_report_doc = new_report_ref.get()

                if new_report_doc.exists:
                    logger.info(f"  Report {report_id} already exists in new location, skipping")
                    skipped_count += 1
                    continue

                if dry_run:
                    logger.info(f"  [DRY RUN] Would migrate report {report_id}")
                    logger.info(f"    From: reports/{uid}/items/{report_id}")
                    logger.info(f"    To:   users/{uid}/reports/{report_id}")
                    logger.info(f"    Data: {list(report_data.keys())}")
                else:
                    # Migrate report to new location
                    new_report_ref.set(report_data)
                    logger.info(f"  Migrated report {report_id}")

                migrated_count += 1

        except Exception as e:
            logger.error(f"Error processing user {uid}: {e}", exc_info=True)
            error_count += 1
            continue

    logger.info("="*60)
    logger.info(f"Migration complete:")
    logger.info(f"  Migrated: {migrated_count}")
    logger.info(f"  Skipped (already exists): {skipped_count}")
    logger.info(f"  Errors: {error_count}")
    logger.info("="*60)

    if dry_run:
        logger.info("\nThis was a DRY RUN. No data was actually migrated.")
        logger.info("Run with --execute flag to perform actual migration.")


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Migrate reports to new Firestore location")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Execute the migration (default is dry-run mode)"
    )
    args = parser.parse_args()

    db = init_firebase()

    logger.info("="*60)
    logger.info("Reports Migration Script")
    logger.info("="*60)
    logger.info(f"Mode: {'EXECUTE' if args.execute else 'DRY RUN'}")
    logger.info("")

    migrate_reports(db, dry_run=not args.execute)


if __name__ == "__main__":
    main()
