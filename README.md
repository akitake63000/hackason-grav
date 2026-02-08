# HairGuard Agent

薄毛対策の継続を支えるAIエージェント。

写真チェックイン、髪密度分析、週次レポート、メンタルサポート、食材推奨機能を提供します。
Firebase + Cloud Run + Vertex AI (Gemini) で構築されたフルスタックアプリケーション。

**デモ**: https://hackason-grab.web.app

---

## 技術スタック

### フロントエンド
- **Next.js** 16.1.6 (App Router, Static Export)
- **React** 19.2
- **Firebase** 12.8 (Auth/Firestore/Storage)
- **TypeScript** 5

### バックエンド
- **FastAPI** (Python 3.12)
- **Firebase Admin SDK**
- **Vertex AI** (Gemini 2.5 Flash)
- **Google Cloud Storage**

### インフラ
- **Firebase Hosting** (フロントエンド配信)
- **Cloud Run** (API実行基盤 - asia-northeast1)
- **Firestore** (データストア)
- **Cloud Storage** (画像保存)

---

## アーキテクチャ

```
User Browser
    ↓
Firebase Hosting (Next.js Static Export)
    ├→ Firebase Auth (Google Sign-In)
    ├→ Firestore (Analysis/Reports/Chats/Food)
    ├→ Cloud Storage (Photos)
    └→ /api/* rewrite → Cloud Run (FastAPI)
                            ├→ Vertex AI (Gemini)
                            ├→ Firestore
                            └→ Cloud Storage
```

---

## 前提条件

以下のツールがインストールされていることを確認してください：

### 必須ツール
- **Node.js** 20+ ([https://nodejs.org/](https://nodejs.org/))
- **Python** 3.12+ ([https://www.python.org/](https://www.python.org/))
- **Firebase CLI** ([https://firebase.google.com/docs/cli](https://firebase.google.com/docs/cli))
  ```bash
  npm install -g firebase-tools
  firebase login
  ```
- **gcloud CLI** ([https://cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install))
  ```bash
  gcloud auth login
  gcloud config set project hackason-grab
  ```

---

## クイックスタート

### Step 1: リポジトリクローン
```bash
git clone https://github.com/your-org/hackason-grab.git
cd hackason-grab
```

### Step 2: フロントエンドセットアップ
```bash
cd apps/web
cp .env.example .env.local
```

`.env.local` に以下を設定：
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

依存関係をインストールして起動：
```bash
npm install
npm run dev
```

→ ブラウザで http://localhost:3000 を開く

### Step 3: バックエンドセットアップ（別ターミナル）
```bash
cd services/agent-api
python3.12 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

→ ブラウザで http://localhost:8000/api/health を開いて `{"status":"ok"}` が表示されることを確認

---

## 開発環境セットアップ

### 5.1 Firebase設定

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクト作成
2. プロジェクト設定 → Web SDK設定を取得
3. `apps/web/.env.local` に設定（Step 2参照）
4. Authentication → Sign-in method → Google を有効化

### 5.2 Cloud Run API設定

Cloud Run環境変数（`gcloud run deploy` 時に設定）:
```bash
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_PROJECT_ID=your-project
ALLOWED_ORIGINS=http://localhost:3000,https://your-project.web.app
GOOGLE_CLOUD_PROJECT=your-project
GOOGLE_CLOUD_LOCATION=global
GOOGLE_GENAI_USE_VERTEXAI=true
GEMINI_MODEL=gemini-2.5-flash
GEMINI_ENABLED=true
```

### 5.3 Firestore・Storageルール

ルールをデプロイ：
```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

### 5.4 Firestoreインデックス

インデックスをデプロイ：
```bash
firebase deploy --only firestore:indexes
```

---

## デプロイ

### フロントエンド（Firebase Hosting）

手動デプロイ：
```bash
firebase deploy --only hosting
```

**自動デプロイ**: GitHub Actions で `main` ブランチへのpush時に自動実行
（`.github/workflows/firebase-hosting-merge.yml`）

### バックエンド（Cloud Run）

```bash
cd services/agent-api
gcloud run deploy agent-api \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars FIREBASE_STORAGE_BUCKET=hackason-grab.appspot.com,FIREBASE_PROJECT_ID=hackason-grab,GOOGLE_CLOUD_PROJECT=hackason-grab,GOOGLE_CLOUD_LOCATION=global,GOOGLE_GENAI_USE_VERTEXAI=true,GEMINI_MODEL=gemini-2.5-flash,GEMINI_ENABLED=true,ALLOWED_ORIGINS=https://hackason-grab.web.app
```

デプロイ後、Cloud Run URLを確認：
```bash
gcloud run services list --project hackason-grab
```

---

## トラブルシューティング

### ログインできない

**症状**: Googleログインボタンをクリックしても認証画面が表示されない

**原因**: Firebase Authenticationの設定不足

**解決策**:
1. [Firebase Console](https://console.firebase.google.com/) → Authentication → Sign-in method → Google を有効化
2. 承認済みドメインに `localhost` が含まれているか確認
3. OAuth Client IDにドメイン制限が設定されている場合、`http://localhost:3000` を追加

### API接続エラー

**症状**: フロントエンドからAPIを呼び出すと404エラーが発生

**原因**: 環境変数の設定ミスまたはCloud Run URLの誤り

**解決策**:
1. `apps/web/.env.local` の `NEXT_PUBLIC_API_BASE` が正しいか確認
   - ローカル: `http://localhost:8000`
   - 本番: Cloud Run URL（例: `https://agent-api-54206639421.asia-northeast1.run.app`）
2. Cloud Run URLを確認: `gcloud run services list --project hackason-grab`
3. `firebase.json` の `rewrites` 設定を確認

### 画像アップロードエラー

**症状**: 写真アップロード時にエラーが発生

**原因**: Storage Rulesの設定不足または画像サイズ超過

**解決策**:
1. `storage.rules` がデプロイされているか確認: `firebase deploy --only storage:rules`
2. 画像サイズ上限: **10MB**
3. 対応形式: `image/*` （JPEG, PNG, etc.）
4. Storage Rulesで `users/{uid}/photos/*` の書き込み権限が設定されているか確認

### デプロイエラー

**症状**: `firebase deploy` または `gcloud run deploy` が失敗する

**原因**: 設定ファイルの誤りまたは権限不足

**解決策**:
1. **Next.js 16エラー**: `swcMinify` オプションは削除済み（Next.js 13+ではデフォルト）
2. **Cloud Run環境変数**: すべての必須環境変数が設定されているか確認
3. **Firebase CLI認証**: `firebase login` で再認証
4. **gcloud認証**: `gcloud auth login` で再認証
5. **IAM権限**: デプロイに必要な権限（Cloud Run Admin, Firebase Hosting Admin等）が付与されているか確認

---

## プロジェクト構成

```
hackason-grab/
├── apps/
│   └── web/                # Next.js (フロントエンド)
│       ├── src/app/        # 画面実装（App Router）
│       ├── src/lib/        # Firebase初期化
│       └── .env.local      # ローカル環境変数
├── services/
│   └── agent-api/          # FastAPI (Cloud Run)
│       ├── app/            # API実装
│       │   ├── main.py     # FastAPIアプリケーション
│       │   └── routers/    # APIルーター
│       └── requirements.txt
├── docs/                   # ドキュメント
│   ├── API.md              # API仕様書（詳細）
│   ├── system_spec.md      # システム仕様書
│   └── チーム分担書.md     # チーム体制・役割分担
├── firestore.rules         # Firestoreセキュリティルール
├── firestore.indexes.json  # Firestoreインデックス定義
├── storage.rules           # Storageセキュリティルール
├── firebase.json           # Firebase設定
└── README.md               # 本ドキュメント
```

---

## 関連ドキュメント

- **[API仕様書](docs/API.md)** - 全APIエンドポイントの詳細仕様
- **[システム仕様書](docs/system_spec.md)** - システム全体の詳細設計
- **[機能一覧書](docs/機能一覧書.md)** - 全46機能の一覧
- **[セキュリティ監査レポート](docs/security-audit-report.md)** - セキュリティ対策実施状況
- **[パフォーマンス最適化ガイド](docs/performance-optimization-guide.md)** - 実施済み最適化の詳細
- **[エラーハンドリングガイド](docs/error-handling-guide.md)** - エラー処理の実装詳細

---

## ライセンス

MIT License

---

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。
