import firebase_admin
from firebase_admin import auth, firestore

from .config import FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET


def init_firebase() -> None:
    if firebase_admin._apps:
        return

    options: dict[str, str] = {}
    if FIREBASE_STORAGE_BUCKET:
        options["storageBucket"] = FIREBASE_STORAGE_BUCKET
    if FIREBASE_PROJECT_ID:
        options["projectId"] = FIREBASE_PROJECT_ID

    firebase_admin.initialize_app(options=options or None)


def verify_id_token(id_token: str):
    init_firebase()
    return auth.verify_id_token(id_token)


def get_firestore_client():
    init_firebase()
    return firestore.client()
