"""
Cloud Storage batch operation utilities with optimized deletion.
Provides helpers for efficient recursive file deletion.
"""

import logging
from typing import List, Iterator
from google.cloud import storage
from google.cloud.exceptions import GoogleCloudError

logger = logging.getLogger(__name__)

# Optimized batch size for Storage operations
# Cloud Storage doesn't have hard batch limits like Firestore,
# but parallel deletion is more efficient than sequential
STORAGE_DELETE_BATCH_SIZE = 100


def chunk_list(items: List, chunk_size: int) -> Iterator[List]:
    """Split a list into chunks of specified size."""
    for i in range(0, len(items), chunk_size):
        yield items[i:i + chunk_size]


def batch_delete_blobs(
    bucket: storage.Bucket,
    blob_names: List[str],
    batch_size: int = STORAGE_DELETE_BATCH_SIZE
) -> int:
    """
    Delete multiple blobs in parallel batches with optimized chunk size.

    Args:
        bucket: Cloud Storage bucket
        blob_names: List of blob names to delete
        batch_size: Number of blobs to delete per batch (default: 100)

    Returns:
        Total number of blobs deleted

    Note:
        This uses parallel deletion within each batch for better performance.
    """
    total_deleted = 0
    errors = []

    for chunk in chunk_list(blob_names, batch_size):
        try:
            # Delete blobs in parallel within the batch
            with bucket.client.batch():
                for blob_name in chunk:
                    try:
                        blob = bucket.blob(blob_name)
                        blob.delete()
                        total_deleted += 1
                    except GoogleCloudError as e:
                        # Log error but continue with other blobs
                        logger.warning(f"Failed to delete blob '{blob_name}': {e}")
                        errors.append((blob_name, str(e)))

            logger.info(f"Batch deleted {len(chunk)} blobs (actual: {total_deleted})")

        except Exception as e:
            logger.error(f"Failed to delete batch of {len(chunk)} blobs: {e}", exc_info=True)
            # Continue with next batch instead of raising
            errors.append(("batch", str(e)))

    if errors:
        logger.warning(f"Encountered {len(errors)} errors during blob deletion")
        for blob_name, error in errors[:10]:  # Log first 10 errors
            logger.warning(f"  - {blob_name}: {error}")

    logger.info(f"Total blobs deleted: {total_deleted}")
    return total_deleted


def recursive_delete_prefix(
    bucket: storage.Bucket,
    prefix: str,
    batch_size: int = STORAGE_DELETE_BATCH_SIZE
) -> int:
    """
    Recursively delete all blobs under a given prefix (folder) with optimized batching.

    Args:
        bucket: Cloud Storage bucket
        prefix: Prefix (folder path) to delete
        batch_size: Number of blobs to delete per batch (default: 100)

    Returns:
        Total number of blobs deleted

    Warning:
        This is a destructive operation. Use with caution.

    Example:
        >>> recursive_delete_prefix(bucket, "users/uid123/photos/")
    """
    total_deleted = 0
    blob_names = []

    # List all blobs with the prefix
    blobs = bucket.list_blobs(prefix=prefix)

    for blob in blobs:
        blob_names.append(blob.name)

        # Delete in batches as we collect blob names
        if len(blob_names) >= batch_size:
            deleted = batch_delete_blobs(bucket, blob_names, batch_size)
            total_deleted += deleted
            blob_names = []

    # Delete remaining blobs
    if blob_names:
        deleted = batch_delete_blobs(bucket, blob_names, batch_size)
        total_deleted += deleted

    logger.info(f"Total blobs deleted with prefix '{prefix}': {total_deleted}")
    return total_deleted


def delete_user_data(
    bucket: storage.Bucket,
    uid: str,
    batch_size: int = STORAGE_DELETE_BATCH_SIZE
) -> dict:
    """
    Delete all storage data for a user (photos, meals, etc.) with optimized batching.

    Args:
        bucket: Cloud Storage bucket
        uid: User ID
        batch_size: Number of blobs to delete per batch (default: 100)

    Returns:
        Dict with deletion statistics per category

    Example:
        >>> stats = delete_user_data(bucket, "uid123")
        >>> print(f"Deleted {stats['photos']} photos, {stats['meals']} meals")
    """
    stats = {
        "photos": 0,
        "meals": 0,
        "total": 0,
    }

    # Delete photos
    photos_prefix = f"users/{uid}/photos/"
    stats["photos"] = recursive_delete_prefix(bucket, photos_prefix, batch_size)

    # Delete meals
    meals_prefix = f"users/{uid}/meals/"
    stats["meals"] = recursive_delete_prefix(bucket, meals_prefix, batch_size)

    stats["total"] = stats["photos"] + stats["meals"]

    logger.info(f"Deleted all storage data for user {uid}: {stats}")
    return stats
