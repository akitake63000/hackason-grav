"""
Firebase Authenticationのユーザー一覧を表示
"""

import sys
import os

# プロジェクトルートをPYTHONPATHに追加
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from firebase_admin import auth, initialize_app
import firebase_admin

def list_users():
    """Firebase Authenticationのユーザー一覧を表示"""
    if not firebase_admin._apps:
        project_id = os.getenv('FIREBASE_PROJECT_ID', 'hackason-grab')
        initialize_app(options={'projectId': project_id})

    print("👤 Firebase Authentication ユーザー一覧")
    print("=" * 70)
    print()

    # ユーザー一覧を取得
    page = auth.list_users()
    user_count = 0

    while page:
        for user in page.users:
            user_count += 1
            print(f"📧 Email: {user.email or '(なし)'}")
            print(f"🆔 UID:   {user.uid}")
            print(f"📅 作成:  {user.user_metadata.creation_timestamp}")
            print(f"🔐 認証:  {user.email_verified if user.email else 'N/A'}")
            print("-" * 70)

        # 次のページがあれば取得
        page = page.get_next_page()

    print()
    print(f"✅ 合計 {user_count} 人のユーザーが見つかりました")

    if user_count == 0:
        print()
        print("⚠️  ユーザーが見つかりませんでした。")
        print("   Firebase Consoleでユーザーを作成してください。")

if __name__ == '__main__':
    list_users()
