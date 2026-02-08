# テストデータ投入ツール

ダッシュボードのテストのために、Firestoreにテストデータを投入するスクリプトです。

## セットアップ

### 1. 依存パッケージのインストール

```bash
cd /home/yujmatsu/projects/hackason-grab
pip install firebase-admin
```

### 2. Firebase認証の設定

以下のいずれかの方法でFirebase Admin SDKの認証を設定してください:

**方法A: gcloud CLIを使用（推奨）**
```bash
gcloud auth application-default login
gcloud config set project hackason-grab
```

**方法B: サービスアカウントキーを使用**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
export FIREBASE_PROJECT_ID="hackason-grab"
```

## 使い方

### 1. ユーザーIDを確認

```bash
cd /home/yujmatsu/projects/hackason-grab/work
python list_users.py
```

出力例:
```
👤 Firebase Authentication ユーザー一覧
======================================================================

📧 Email: test@example.com
🆔 UID:   abc123xyz456
📅 作成:  2024-01-15 10:30:00
🔐 認証:  True
----------------------------------------------------------------------

✅ 合計 1 人のユーザーが見つかりました
```

### 2. テストデータを投入

```bash
# 6ヶ月分のデータを投入（デフォルト）
python seed_test_data.py <USER_ID>

# 例: abc123xyz456 ユーザーに6ヶ月分
python seed_test_data.py abc123xyz456

# カスタム期間（例: 3ヶ月分）
python seed_test_data.py abc123xyz456 3
```

### 3. データの確認

ダッシュボードにアクセスして確認:
```
https://hackason-grab.web.app/feature1/dashboard/
```

または、Firestoreコンソールで確認:
```
https://console.firebase.google.com/project/hackason-grab/firestore/data
```

## 投入されるデータ

- **期間**: 過去6ヶ月（デフォルト）
- **件数**: 月あたり1〜3件（ランダム）
- **スコア**: 50〜85点の範囲でランダムに変動
- **タイムスタンプ**: 過去の日時で現実的な時刻（9時〜20時）

### データ構造

**users/{uid}/photos/{photoId}**
```json
{
  "photoId": "test_photo_001",
  "capturedAt": "2024-08-15T14:30:00Z",
  "storagePath": "users/{uid}/photos/test_photo_001.jpg",
  "downloadUrl": "https://...",
  "status": "analyzed",
  "createdAt": "2024-08-15T14:30:00Z"
}
```

**users/{uid}/analysisResults/{photoId}**
```json
{
  "photoId": "test_photo_001",
  "score": 72.5,
  "notes": "髪密度は良好な状態です...",
  "analyzedAt": "2024-08-15T14:30:30Z",
  "version": "v1-gemini-1.5-flash"
}
```

## トラブルシューティング

### エラー: "The Application Default Credentials are not available"

Firebase認証が設定されていません。セットアップ手順の「Firebase認証の設定」を参照してください。

### エラー: "Permission denied"

使用しているアカウントにFirestoreへの書き込み権限がありません。
プロジェクトのIAMで適切な権限を付与してください。

### データが表示されない

1. ブラウザのキャッシュをクリア（Ctrl+Shift+R）
2. 正しいユーザーでログインしているか確認
3. Firestoreコンソールでデータが投入されているか確認

## データのクリーンアップ

テストデータを削除したい場合は、Firestoreコンソールから手動で削除してください:
```
https://console.firebase.google.com/project/hackason-grab/firestore/data/~2Fusers~2F{uid}~2FanalysisResults
https://console.firebase.google.com/project/hackason-grab/firestore/data/~2Fusers~2F{uid}~2Fphotos
```
