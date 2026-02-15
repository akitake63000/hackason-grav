"""
Firebase client initialization
Copied pattern from services/agent-api/app/firebase.py
"""
import firebase_admin
from firebase_admin import firestore
import os

def init_firebase() -> None:
    """Initialize Firebase Admin SDK if not already initialized"""
    if firebase_admin._apps:
        return

    # For Cloud Functions, credentials are automatically provided
    options = {}
    project_id = os.getenv("FIREBASE_PROJECT_ID", "hackason-grab")
    storage_bucket = os.getenv("FIREBASE_STORAGE_BUCKET")

    if project_id:
        options["projectId"] = project_id
    if storage_bucket:
        options["storageBucket"] = storage_bucket

    firebase_admin.initialize_app(options=options or None)

def get_firestore_client():
    """Get Firestore client"""
    init_firebase()
    return firestore.client()
