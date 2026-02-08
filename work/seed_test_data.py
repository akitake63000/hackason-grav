"""
テストデータ投入スクリプト

過去6ヶ月分の写真と解析結果をFirestoreに投入します。
"""

import sys
import os
from datetime import datetime, timedelta
import random

# プロジェクトルートをPYTHONPATHに追加
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from firebase_admin import credentials, firestore, initialize_app, storage
import firebase_admin

# Firebase初期化
def init_firebase():
    """Firebase Admin SDKを初期化"""
    if not firebase_admin._apps:
        # 環境変数またはデフォルト認証を使用
        project_id = os.getenv('FIREBASE_PROJECT_ID', 'hackason-grab')
        initialize_app(options={
            'projectId': project_id,
            'storageBucket': f'{project_id}.firebasestorage.app'
        })
    return firestore.client()

def generate_test_data(uid: str, months: int = 6):
    """
    テストデータを生成

    Args:
        uid: ユーザーID
        months: 何ヶ月分のデータを生成するか
    """
    db = init_firebase()

    # 現在日時から過去に遡ってデータを生成
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30 * months)

    # 毎日1件のデータを生成
    current_date = start_date
    photo_count = 0
    score = random.uniform(60, 75)  # 初期スコア

    print(f"🚀 テストデータ投入開始: {uid}")
    print(f"📅 期間: {start_date.strftime('%Y-%m-%d')} 〜 {end_date.strftime('%Y-%m-%d')}")
    print(f"📊 予定件数: 約{(end_date - start_date).days}件")
    print()

    while current_date <= end_date:
        # ランダムな時刻を生成（9時〜20時）
        hours_offset = random.randint(9, 20)
        minutes_offset = random.randint(0, 59)

        captured_at = current_date.replace(
            hour=hours_offset,
            minute=minutes_offset,
            second=0,
            microsecond=0
        )

        # 過去の日付のみ
        if captured_at > end_date:
            break

        photo_count += 1
        photo_id = f"test_photo_{photo_count:03d}"

        # スコアは前日比で±3〜7の変動（50〜85の範囲）
        change = random.uniform(-7, 7)
        score = max(50, min(85, score + change))

        # 写真メタデータ
        photo_data = {
            'photoId': photo_id,
            'capturedAt': captured_at,
            'storagePath': f'users/{uid}/photos/{photo_id}.jpg',
            'downloadUrl': f'https://firebasestorage.googleapis.com/v0/b/hackason-grab.firebasestorage.app/o/users%2F{uid}%2Fphotos%2F{photo_id}.jpg?alt=media',
            'status': 'analyzed',
            'createdAt': captured_at,
        }

        # 解析結果
        analysis_data = {
            'photoId': photo_id,
            'score': round(score, 1),
            'notes': generate_notes(score),
            'analyzedAt': captured_at + timedelta(seconds=30),
            'version': 'v1-gemini-1.5-flash',
        }

        # Firestoreに保存
        db.collection('users').document(uid).collection('photos').document(photo_id).set(photo_data)
        db.collection('users').document(uid).collection('analysisResults').document(photo_id).set(analysis_data)

        print(f"✅ {captured_at.strftime('%Y-%m-%d %H:%M')} - スコア: {score:.1f}点 - {photo_id}")

        # 次の日へ
        current_date += timedelta(days=1)

    print()
    print(f"🎉 完了: {photo_count}件のテストデータを投入しました")

def generate_notes(score: float) -> str:
    """スコアに応じたコメントを生成"""
    if score >= 75:
        templates = [
            "髪密度は良好な状態です。現在のケアを継続してください。",
            "頭皮環境が健康的に保たれています。この調子で継続しましょう。",
            "髪の成長が順調です。良い状態が維持されています。",
        ]
    elif score >= 60:
        templates = [
            "髪密度は標準的な範囲です。生活習慣の見直しをおすすめします。",
            "若干の髪密度低下が見られます。ストレス管理と栄養バランスに注意してください。",
            "現在の状態を維持するため、規則正しい生活を心がけましょう。",
        ]
    else:
        templates = [
            "髪密度の低下が見られます。専門医への相談を検討してください。",
            "頭皮環境の改善が必要です。適切なケアと栄養摂取を心がけましょう。",
            "髪の成長サイクルに変化が見られます。早めの対策をおすすめします。",
        ]

    return random.choice(templates)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("❌ 使い方: python seed_test_data.py <USER_ID> [months]")
        print()
        print("例:")
        print("  python seed_test_data.py abc123 6     # 6ヶ月分")
        print("  python seed_test_data.py abc123       # デフォルト6ヶ月分")
        sys.exit(1)

    uid = sys.argv[1]
    months = int(sys.argv[2]) if len(sys.argv) > 2 else 6

    generate_test_data(uid, months)
