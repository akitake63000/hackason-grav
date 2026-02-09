
import firebase_admin
from firebase_admin import credentials, firestore, auth

# Initialize App
if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {
        'projectId': 'hackason-grab',
    })

db = firestore.client()

TARGET_PHOTO_ID = "e40e5d21-2eff-4dcf-af55-0afe15514e71"

print(f"Searching for photoId: {TARGET_PHOTO_ID}...")

# 1. List all users (since we don't know UID)
page = auth.list_users()
while page:
    for user in page.users:
        uid = user.uid
        print(f"Checking user: {uid}")
        
        # Check specific photo document
        doc_ref = db.collection("users").document(uid).collection("analysisResults").document(TARGET_PHOTO_ID)
        doc = doc_ref.get()
        
        if doc.exists:
            print(f"FOUND! Updating document for user {uid}...")
            
            # Patch Data
            current_data = doc.to_dict()
            current_score = current_data.get("score", 0)
            
            update_data = {
                "hairType": "薄毛の傾向",
                "pattern": "M字",
                "scalpCondition": "乾燥",
                "delta": 3.5, # Dummy delta
                "notes": current_data.get("notes", "") + "\n\n(手動パッチ適用済み: M字, 乾燥, +3.5)"
            }
            
            doc_ref.update(update_data)
            print("Update complete!")
            print(f"New Data: {update_data}")
            exit(0)
            
    # Get next page
    page = page.get_next_page()

print("Photo ID not found in any user's analysisResults.")
