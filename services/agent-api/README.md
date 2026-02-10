# HairGuard Agent API

薄毛対策アプリ「HairGuard」のバックエンドAPI

## 概要

- **フレームワーク**: FastAPI (Python 3.11+)
- **データベース**: Firebase Firestore
- **ストレージ**: Firebase Storage
- **AI**: Google Gemini (画像解析・チャット)
- **認証**: Firebase Authentication
- **エラー監視**: Sentry

## 主要機能

### 1. 写真分析 (`/api/v1/photos`)
- 頭皮写真の解析（Gemini Vision API）
- 分析履歴の取得

### 2. レポート生成 (`/api/v1/reports`)
- 週次レポート生成（LLM活用）

### 3. メンタルシールド (`/api/v1/mental-shield`)
- 薄毛に関する悩み相談チャット
- 専門家との連携

### 4. フードスナイパー (`/api/v1/food-sniper`)
- 薄毛パターン別の栄養・食品推奨
- レシピ生成

### 5. ライフスタイル分析 (`/api/v1/lifestyle`)
- 生活習慣分析
- 改善プラン生成

## セットアップ

### 1. 環境変数設定

`.env.local` ファイルを作成：

```bash
# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-bucket.appspot.com

# Google Cloud
GOOGLE_API_KEY=your-api-key
# OR
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=your-project
GOOGLE_CLOUD_LOCATION=global

# Gemini Models
GEMINI_MODEL=gemini-2.5-flash
GEMINI_MODEL_HEAVY=gemini-2.0-flash-thinking-exp-01-21

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Sentry (optional)
SENTRY_DSN=your-sentry-dsn
ENVIRONMENT=development
```

### 2. 依存関係インストール

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Firebase認証情報

Firebase Admin SDKの認証情報ファイルを設置：

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
```

### 4. 起動

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API: `http://localhost:8000`
ドキュメント: `http://localhost:8000/docs`

## セキュリティ

### 認証
- すべてのエンドポイント（`/health`除く）はFirebase ID Tokenによる認証必須
- `Authorization: Bearer <token>` ヘッダーで送信

### レート制限
- `/photos/analyze`: 5リクエスト/分
- `/photos/analysis-history`: 100リクエスト/分
- `/reports/generate`: 3リクエスト/分
- その他エンドポイント: 各種制限あり

### エラーハンドリング
統一されたエラーレスポンス形式：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message",
    "status": 400,
    "details": {},
    "request_id": "uuid"
  }
}
```

## 開発

### コードフォーマット
```bash
black app/
isort app/
```

### テスト
```bash
pytest tests/
```

### Linting
```bash
flake8 app/
mypy app/
```

## ディレクトリ構造

```
app/
├── main.py                 # FastAPI アプリケーション
├── config.py               # 設定
├── auth.py                 # 認証
├── firebase.py             # Firebase初期化
├── storage.py              # Storage操作
├── error_handler.py        # エラーハンドリング
├── env_validator.py        # 環境変数検証
├── routers/                # APIエンドポイント
│   ├── photos.py
│   ├── reports.py
│   ├── mental_shield.py
│   ├── food_sniper.py
│   └── lifestyle.py
├── services/               # ビジネスロジック
│   ├── gemini_vision.py    # 画像解析
│   └── gemini_chat.py      # チャット
├── middleware/             # ミドルウェア
│   ├── rate_limit.py       # レート制限
│   └── monitoring.py       # 監視
├── monitoring/             # エラー監視
│   └── sentry.py           # Sentry統合
├── utils/                  # ユーティリティ
│   ├── firestore_batch.py  # Firestore バッチ操作
│   └── storage_batch.py    # Storage バッチ操作
└── data/                   # 外部データ
    └── pattern_food_map.json  # 食品推奨データ
```

## 最近の改善（Phase 1-4）

### Phase 1: Critical Security Fixes
- トークンログ削除
- 認証エラーハンドリング改善
- URLバリデーション強化

### Phase 2: Performance & Reliability
- N+1クエリ問題解消
- バッチ操作ユーティリティ追加
- 環境変数検証強化

### Phase 3: Unified Error Handling
- 統一エラーハンドリングシステム
- Sentry エラー監視強化
- レート制限適用

### Phase 4: Code Quality
- Pydantic v2 移行開始
- 大規模データ構造の外部ファイル化

## ライセンス

Proprietary
