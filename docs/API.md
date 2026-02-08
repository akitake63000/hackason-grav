# HairGuard Agent API仕様書

最終更新: 2026-02-06

---

## 概要

HairGuard Agent APIは、薄毛対策AIエージェントのバックエンドサービスです。
写真解析、レポート生成、メンタルサポート、食材推奨、ライフスタイルアドバイス機能を提供します。

---

## ベースURL

| 環境 | URL |
|------|-----|
| 本番環境 | `https://hackason-grab.web.app/api` |
| Cloud Run直接 | `https://agent-api-54206639421.asia-northeast1.run.app` |
| ローカル開発 | `http://localhost:8000` |

**注意**: 本番環境ではFirebase Hostingの `/api/**` rewriteを通してCloud Runにアクセスします。

---

## バージョニング

- **現在のAPIバージョン**: `v1`
- **ヘルスチェック** (`/api/health`, `/api/v1/lifestyle/health`) はバージョン非依存（全バージョン共通）
- **後方互換性のない変更時**: 新バージョン (`/api/v2/`) を作成し、既存バージョンは一定期間維持

---

## 認証

### Firebase ID Token

全ての認証必須エンドポイントは、Firebase ID Tokenを使用します。

**リクエストヘッダー**:
```http
Authorization: Bearer <firebase_id_token>
```

**トークンの取得方法**:
```javascript
// JavaScript (Firebase SDK)
const user = firebase.auth().currentUser;
const token = await user.getIdToken();
```

**トークン情報**:
- **有効期限**: 1時間
- **自動リフレッシュ**: Firebase SDKが自動でトークンをリフレッシュ
- **手動リフレッシュ**:
  ```javascript
  const token = await firebase.auth().currentUser.getIdToken(true);
  ```

**認証不要エンドポイント**:
- `GET /api/health`
- `GET /api/v1/lifestyle/health`

---

## エンドポイント一覧

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/api/health` | APIヘルスチェック | 不要 |
| POST | `/api/v1/photos/analyze` | 頭部写真の解析（髪密度指数算出） | 必須 |
| POST | `/api/v1/reports/generate` | 週次レポート生成 | 必須 |
| POST | `/api/v1/mental-shield/chat` | メンタルサポートチャット（3人格対応） | 必須 |
| POST | `/api/v1/food-sniper/recommend` | 食材・店舗推奨 | 必須 |
| GET | `/api/v1/lifestyle/health` | ライフスタイル健康チェック | 不要 |
| GET | `/api/v1/lifestyle/tip` | ライフスタイルアドバイス取得 | 必須 |

---

## エンドポイント詳細

### 1. ヘルスチェック

**エンドポイント**: `GET /api/health`

**説明**: APIの稼働状態を確認します。

**認証**: 不要

**レスポンス**:
```json
{
  "status": "ok"
}
```

**使用例**:
```bash
curl https://hackason-grab.web.app/api/health
```

---

### 2. 写真解析

**エンドポイント**: `POST /api/v1/photos/analyze`

**説明**: 頭部写真を解析し、髪密度指数（0-100）を算出します。前回・初回データとの比較も実施。

**認証**: 必須

**リクエストボディ**:
```json
{
  "photoId": "photo_20260206_123456",
  "storagePath": "users/{uid}/photos/photo_20260206_123456.jpg",
  "capturedAt": "2026-02-06T12:34:56Z",
  "roiPreset": "crown"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `photoId` | string | ✅ | 写真ID |
| `storagePath` | string | ✅ | Cloud Storageのパス |
| `capturedAt` | string | ❌ | 撮影日時（ISO 8601形式） |
| `roiPreset` | string | ❌ | 解析領域プリセット（`crown`, `front`, `temple`） |

**レスポンス**:
```json
{
  "densityIndex": 72.5,
  "deltaVsPrev": -2.3,
  "deltaVsBase": -5.8,
  "quality": {
    "score": 0.85,
    "warnings": ["照明がやや暗いです"]
  },
  "analysisId": "analysis_photo_20260206_123456"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `densityIndex` | float | 髪密度指数（0-100、高いほど密度が高い） |
| `deltaVsPrev` | float | 前回との差分（プラスは改善） |
| `deltaVsBase` | float | 初回との差分（プラスは改善） |
| `quality.score` | float | 画像品質スコア（0-1） |
| `quality.warnings` | string[] | 品質警告メッセージ |
| `analysisId` | string | 解析結果ID |

**使用例**:
```bash
curl -X POST https://hackason-grab.web.app/api/v1/photos/analyze \
  -H "Authorization: Bearer <firebase_id_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "photoId": "photo_20260206_123456",
    "storagePath": "users/abc123/photos/photo_20260206_123456.jpg"
  }'
```

---

### 3. レポート生成

**エンドポイント**: `POST /api/v1/reports/generate`

**説明**: 指定期間の解析データから週次レポートを生成します（Gemini AI使用）。

**認証**: 必須

**リクエストボディ**:
```json
{
  "periodDays": 7
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `periodDays` | integer | ❌ | 対象期間（日数、デフォルト: 7、範囲: 1-30） |

**レスポンス**:
```json
{
  "reportId": "report_20260206_123456",
  "highlights": [
    "この1週間で髪密度指数が平均2.5ポイント改善しました",
    "継続的な記録が習慣化されています"
  ],
  "nextActions": [
    "引き続き規則正しい生活リズムを維持しましょう",
    "栄養バランスを意識した食事を心がけましょう"
  ],
  "rawText": "この1週間の記録から、髪の状態が良い方向に向かっていることが確認できます。..."
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `reportId` | string | レポートID |
| `highlights` | string[] | ハイライト（2-3件） |
| `nextActions` | string[] | 次のアクション提案（2-3件） |
| `rawText` | string | レポート全文 |

**使用例**:
```bash
curl -X POST https://hackason-grab.web.app/api/v1/reports/generate \
  -H "Authorization: Bearer <firebase_id_token>" \
  -H "Content-Type: application/json" \
  -d '{"periodDays": 7}'
```

---

### 4. メンタルサポートチャット

**エンドポイント**: `POST /api/v1/mental-shield/chat`

**説明**: 3人格（encourager/coach/doctor）によるメンタルサポート回答を生成します（Gemini AI使用）。

**認証**: 必須

**リクエストボディ**:
```json
{
  "threadId": "thread_default",
  "message": "最近抜け毛が気になっています...",
  "mode": "balanced"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `threadId` | string | ❌ | スレッドID（デフォルト: `"default"`） |
| `message` | string | ✅ | ユーザーメッセージ |
| `mode` | string | ❌ | モード（`"balanced"`, `"supportive"`, `"analytical"`） |

**レスポンス**:
```json
{
  "cards": [
    {
      "agent": "encourager",
      "text": "抜け毛に気づけたこと自体が、ケアへの第一歩ですよ。前向きに取り組みましょう。"
    },
    {
      "agent": "coach",
      "text": "まずは規則正しい生活リズムと栄養バランスを整えることから始めましょう。"
    },
    {
      "agent": "doctor",
      "text": "季節の変わり目は抜け毛が増えやすい時期です。極端な変化がなければ経過観察で良いでしょう。"
    }
  ],
  "summary": "抜け毛は多くの人が経験する悩みです。生活習慣の見直しと継続的な観察が大切です。",
  "threadId": "thread_default"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `cards` | object[] | 3人格の回答カード |
| `cards[].agent` | string | エージェント名（`encourager`, `coach`, `doctor`） |
| `cards[].text` | string | 回答テキスト |
| `summary` | string | 総括メッセージ |
| `threadId` | string | スレッドID |

**使用例**:
```bash
curl -X POST https://hackason-grab.web.app/api/v1/mental-shield/chat \
  -H "Authorization: Bearer <firebase_id_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "最近抜け毛が気になっています..."
  }'
```

---

### 5. 食材・店舗推奨

**エンドポイント**: `POST /api/v1/food-sniper/recommend`

**説明**: ユーザーの要望と位置情報から、育毛に良い食材と近隣店舗を推奨します。

**認証**: 必須

**リクエストボディ**:
```json
{
  "message": "タンパク質を摂りたい",
  "location": {
    "lat": 35.6812,
    "lng": 139.7671,
    "accuracyM": 50
  },
  "radiusM": 800
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `message` | string | ✅ | ユーザーの要望 |
| `location` | object | ❌ | 位置情報 |
| `location.lat` | float | ✅ | 緯度 |
| `location.lng` | float | ✅ | 経度 |
| `location.accuracyM` | float | ❌ | 精度（メートル） |
| `radiusM` | integer | ❌ | 検索半径（メートル、デフォルト: 800） |

**レスポンス**:
```json
{
  "items": [
    {
      "name": "卵",
      "why": "タンパク質とビオチンの補給（一般論）"
    },
    {
      "name": "鶏むね",
      "why": "高タンパクで続けやすい（一般論）"
    }
  ],
  "stores": [
    {
      "name": "スーパーA",
      "distanceM": 350,
      "confidence": 0.9,
      "note": "生鮮食品が充実"
    }
  ],
  "shoppingList": ["卵", "鶏むね"]
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `items` | object[] | 推奨食材リスト |
| `items[].name` | string | 食材名 |
| `items[].why` | string | 推奨理由 |
| `stores` | object[] | 近隣店舗候補 |
| `stores[].name` | string | 店舗名 |
| `stores[].distanceM` | integer | 距離（メートル） |
| `stores[].confidence` | float | 信頼度（0-1） |
| `stores[].note` | string | 備考 |
| `shoppingList` | string[] | 買い物リスト |

**使用例**:
```bash
curl -X POST https://hackason-grab.web.app/api/v1/food-sniper/recommend \
  -H "Authorization: Bearer <firebase_id_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "タンパク質を摂りたい",
    "location": {"lat": 35.6812, "lng": 139.7671}
  }'
```

---

### 6. ライフスタイル健康チェック

**エンドポイント**: `GET /api/v1/lifestyle/health`

**説明**: ライフスタイルAPIの稼働状態を確認します。

**認証**: 不要

**レスポンス**:
```json
{
  "status": "ok"
}
```

**使用例**:
```bash
curl https://hackason-grab.web.app/api/v1/lifestyle/health
```

---

### 7. ライフスタイルアドバイス

**エンドポイント**: `GET /api/v1/lifestyle/tip`

**説明**: 現在の時刻・季節に応じたライフスタイルアドバイスを取得します（Gemini AI使用）。

**認証**: 必須

**レスポンス**:
```json
{
  "tip": "花粉や乾燥で頭皮がゆらぎやすい季節です。洗浄は優しく、保湿を意識しましょう。",
  "source": "llm"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `tip` | string | アドバイステキスト |
| `source` | string | 生成元（`"llm"`: Gemini AI, `"fallback"`: ルールベース） |

**使用例**:
```bash
curl https://hackason-grab.web.app/api/v1/lifestyle/tip \
  -H "Authorization: Bearer <firebase_id_token>"
```

---

## エラーレスポンス

### 共通エラーフォーマット

```json
{
  "detail": "エラーメッセージ"
}
```

### HTTPステータスコード

| ステータスコード | 説明 |
|-----------------|------|
| `200 OK` | リクエスト成功 |
| `400 Bad Request` | リクエストパラメータ不正 |
| `401 Unauthorized` | 認証トークンが無効または期限切れ |
| `404 Not Found` | エンドポイントが存在しない |
| `500 Internal Server Error` | サーバー内部エラー |

### エラーコード一覧

| エラーコード | HTTPステータス | 説明 |
|-------------|---------------|------|
| `INVALID_IMAGE_FORMAT` | 400 | サポートされていない画像形式 |
| `IMAGE_TOO_LARGE` | 400 | 画像サイズが10MBを超過 |
| `ANALYSIS_FAILED` | 400 | 画像解析処理に失敗 |
| `FAILED_TO_LOAD_IMAGE` | 400 | Cloud Storageから画像の読み込みに失敗 |
| `UNAUTHORIZED` | 401 | 認証トークンが無効または期限切れ |
| `INSUFFICIENT_DATA` | 400 | データ不足でレポート生成不可 |

### エラーレスポンス例

**認証エラー**:
```json
{
  "detail": "Invalid or expired authentication token"
}
```

**画像解析エラー**:
```json
{
  "detail": "Failed to analyze image"
}
```

---

## レート制限

現在、レート制限は設定されていません。
将来的に実装する場合は、以下のヘッダーで情報を提供します：

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```

---

## 使用例（完全なフロー）

### 1. 認証トークン取得
```javascript
// JavaScript (Firebase SDK)
const user = firebase.auth().currentUser;
const token = await user.getIdToken();
```

### 2. 写真解析
```bash
curl -X POST https://hackason-grab.web.app/api/v1/photos/analyze \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6..." \
  -H "Content-Type: application/json" \
  -d '{
    "photoId": "photo_20260206_123456",
    "storagePath": "users/abc123/photos/photo_20260206_123456.jpg",
    "roiPreset": "crown"
  }'
```

### 3. レポート生成
```bash
curl -X POST https://hackason-grab.web.app/api/v1/reports/generate \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6..." \
  -H "Content-Type: application/json" \
  -d '{"periodDays": 7}'
```

---

## 関連ドキュメント

- **[README.md](../README.md)** - プロジェクト全体のセットアップ手順
- **[システム仕様書](system_spec.md)** - システム全体の詳細設計
- **[機能一覧書](機能一覧書.md)** - 全46機能の一覧
- **[エラーハンドリングガイド](error-handling-guide.md)** - エラー処理の実装詳細
