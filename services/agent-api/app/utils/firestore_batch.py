"""
Firestore batch operation utilities with optimized chunk sizes.
Provides helpers for efficient batch writes and deletes.
"""

import logging
from typing import List, Iterator, TypeVar, Callable
from google.cloud import firestore
from firebase_admin import firestore as admin_firestore

logger = logging.getLogger(__name__)

T = TypeVar('T')

# Optimized chunk sizes based on Firestore limits and performance testing
# Firestore limit is 500 operations per batch, but 400 is more reliable
# to account for network latency and potential retries
BATCH_WRITE_CHUNK_SIZE = 400
BATCH_DELETE_CHUNK_SIZE = 400


def chunk_list(items: List[T], chunk_size: int) -> Iterator[List[T]]:
    """
    Split a list into chunks of specified size.

    Args:
        items: List to chunk
        chunk_size: Size of each chunk

    Yields:
        List chunks
    """
    for i in range(0, len(items), chunk_size):
        yield items[i:i + chunk_size]


def batch_delete_documents(
    db: firestore.Client,
    doc_refs: List[firestore.DocumentReference],
    chunk_size: int = BATCH_DELETE_CHUNK_SIZE
) -> int:
    """
    Delete multiple documents in batches with optimized chunk size.

    Args:
        db: Firestore client
        doc_refs: List of document references to delete
        chunk_size: Number of deletes per batch (default: 400)

    Returns:
        Total number of documents deleted

    Raises:
        Exception: If batch deletion fails
    """
    total_deleted = 0

    for chunk in chunk_list(doc_refs, chunk_size):
        batch = db.batch()
        for doc_ref in chunk:
            batch.delete(doc_ref)

        try:
            batch.commit()
            total_deleted += len(chunk)
            logger.info(f"Batch deleted {len(chunk)} documents")
        except Exception as e:
            logger.error(f"Failed to delete batch of {len(chunk)} documents: {e}", exc_info=True)
            raise

    logger.info(f"Total documents deleted: {total_deleted}")
    return total_deleted


def batch_write_documents(
    db: firestore.Client,
    operations: List[tuple[firestore.DocumentReference, dict]],
    chunk_size: int = BATCH_WRITE_CHUNK_SIZE
) -> int:
    """
    Write multiple documents in batches with optimized chunk size.

    Args:
        db: Firestore client
        operations: List of (document_reference, data) tuples
        chunk_size: Number of writes per batch (default: 400)

    Returns:
        Total number of documents written

    Raises:
        Exception: If batch write fails
    """
    total_written = 0

    for chunk in chunk_list(operations, chunk_size):
        batch = db.batch()
        for doc_ref, data in chunk:
            batch.set(doc_ref, data)

        try:
            batch.commit()
            total_written += len(chunk)
            logger.info(f"Batch wrote {len(chunk)} documents")
        except Exception as e:
            logger.error(f"Failed to write batch of {len(chunk)} documents: {e}", exc_info=True)
            raise

    logger.info(f"Total documents written: {total_written}")
    return total_written


def batch_update_documents(
    db: firestore.Client,
    operations: List[tuple[firestore.DocumentReference, dict]],
    chunk_size: int = BATCH_WRITE_CHUNK_SIZE
) -> int:
    """
    Update multiple documents in batches with optimized chunk size.

    Args:
        db: Firestore client
        operations: List of (document_reference, update_data) tuples
        chunk_size: Number of updates per batch (default: 400)

    Returns:
        Total number of documents updated

    Raises:
        Exception: If batch update fails
    """
    total_updated = 0

    for chunk in chunk_list(operations, chunk_size):
        batch = db.batch()
        for doc_ref, data in chunk:
            batch.update(doc_ref, data)

        try:
            batch.commit()
            total_updated += len(chunk)
            logger.info(f"Batch updated {len(chunk)} documents")
        except Exception as e:
            logger.error(f"Failed to update batch of {len(chunk)} documents: {e}", exc_info=True)
            raise

    logger.info(f"Total documents updated: {total_updated}")
    return total_updated


def recursive_delete_collection(
    db: firestore.Client,
    collection_ref: firestore.CollectionReference,
    batch_size: int = BATCH_DELETE_CHUNK_SIZE
) -> int:
    """
    Recursively delete all documents in a collection and its subcollections.
    Uses optimized batch size for better performance.

    Args:
        db: Firestore client
        collection_ref: Collection reference to delete
        batch_size: Number of documents to delete per batch (default: 400)

    Returns:
        Total number of documents deleted

    Warning:
        This is a destructive operation. Use with caution.
    """
    total_deleted = 0
    docs = collection_ref.limit(batch_size).stream()

    deleted_in_batch = 0
    batch = db.batch()

    for doc in docs:
        # Delete subcollections first (recursive)
        for subcollection in doc.reference.collections():
            total_deleted += recursive_delete_collection(db, subcollection, batch_size)

        # Add document to batch delete
        batch.delete(doc.reference)
        deleted_in_batch += 1

        # Commit batch when it reaches the size limit
        if deleted_in_batch >= batch_size:
            batch.commit()
            total_deleted += deleted_in_batch
            logger.info(f"Deleted batch of {deleted_in_batch} documents")
            deleted_in_batch = 0
            batch = db.batch()

    # Commit remaining documents
    if deleted_in_batch > 0:
        batch.commit()
        total_deleted += deleted_in_batch
        logger.info(f"Deleted final batch of {deleted_in_batch} documents")

    logger.info(f"Total documents deleted from collection: {total_deleted}")
    return total_deleted
