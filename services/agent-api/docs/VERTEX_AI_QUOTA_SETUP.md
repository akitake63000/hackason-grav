# Vertex AI Quota（レート制限）の設定手順

Vertex AI APIで`Resource exhausted (HTTP 429)`エラーが発生した場合、quotaを引き上げる必要があります。

## 現象

```
ClientError: Resource exhausted
Error 429 from Vertex AI Generative AI API
```

このエラーは、以下の制限を超過した場合に発生します：
- **RPM (Requests Per Minute)**: 1分あたりのリクエスト数
- **TPM (Tokens Per Minute)**: 1分あたりのトークン数

---

## 対策1: Google Cloud Consoleでquotaを引き上げる【推奨】

### 手順

1. **Google Cloud Consoleにアクセス**
   - https://console.cloud.google.com/

2. **プロジェクトを選択**
   - `hackason-grab` プロジェクト（または該当するプロジェクト）

3. **IAM & Admin > Quotas に移動**
   - 左メニュー: 「IAM と管理」 → 「割り当て」
   - または直接: https://console.cloud.google.com/iam-admin/quotas

4. **Vertex AI Gemini APIのquotaを検索**
   - 検索ボックスに以下を入力：
     ```
     Vertex AI API
     ```
   - フィルタ:
     - **Service**: `Vertex AI API`
     - **Metric**: `GenerateContent requests per minute per project per region`

5. **現在のquotaを確認**
   - デフォルト: **60 RPM** (Requests Per Minute)
   - これが上限を超えていると429エラーが発生

6. **Quota引き上げをリクエスト**
   - 該当するquotaを選択
   - 「割り当てを編集」をクリック
   - 新しい上限値を入力（例: **300 RPM**）
   - リクエストを送信

7. **承認を待つ**
   - 通常、**数分〜数時間**で自動承認されます
   - 大幅な引き上げの場合は、Googleの審査が必要な場合があります

---

## 対策2: アプリケーション側でレート制限を調整

quotaの引き上げを待つ間、または追加の安全策として、以下の環境変数を調整できます。

### 環境変数

```bash
# services/agent-api/.env

# リトライ設定
GEMINI_RETRY_MAX_ATTEMPTS=3           # 最大リトライ回数（デフォルト: 3）
GEMINI_RETRY_BASE_DELAY=1.0           # 初回リトライまでの待機秒数（デフォルト: 1.0秒）

# レート制限（参考値）
GEMINI_RATE_LIMIT_RPM=60              # 目標RPM（デフォルト: 60）
```

### リトライ動作

- **1回目のエラー**: 1秒後にリトライ
- **2回目のエラー**: 2秒後にリトライ
- **3回目のエラー**: 4秒後にリトライ
- **4回目**: エラーをユーザーに返す（フォールバック処理へ）

---

## 対策3: モデルを変更する

高速・軽量なモデルを使用することで、リクエスト数を減らすことができます。

### モデル比較

| モデル | RPM制限 | レスポンス速度 | 精度 | 推奨用途 |
|--------|---------|---------------|------|----------|
| `gemini-2.0-flash` | 高い | 非常に高速 | 標準 | 一般的なチャット、食材推薦 |
| `gemini-2.5-flash` | 高い | 高速 | 高い | バランス型 |
| `gemini-2.5-pro` | 低い | 低速 | 非常に高い | 複雑な分析、画像解析 |

### 設定変更

```bash
# services/agent-api/.env

# デフォルトモデルをflashに変更（現在の設定）
GEMINI_MODEL=gemini-2.5-flash

# 軽量タスク用
GEMINI_MODEL_LIGHT=gemini-2.5-flash

# 重いタスク用（必要な場合のみ）
GEMINI_MODEL_HEAVY=gemini-2.5-pro
```

---

## 対策4: リージョンを変更する

特定のリージョンでquotaが不足している場合、別のリージョンに切り替えることも検討できます。

```bash
# services/agent-api/.env

# デフォルト: global
GOOGLE_CLOUD_LOCATION=global

# 代替リージョン（例）
# GOOGLE_CLOUD_LOCATION=us-central1
# GOOGLE_CLOUD_LOCATION=asia-northeast1  # 東京
```

**注意**: リージョン変更時は、Vertex AIサービスが有効化されているか確認してください。

---

## 現在のquotaを確認する方法

### Google Cloud Consoleで確認

1. https://console.cloud.google.com/iam-admin/quotas
2. フィルタ: `Vertex AI API`
3. 現在の使用量と上限を確認

### gcloud CLIで確認

```bash
# quotaの一覧を取得
gcloud compute project-info describe --project=hackason-grab \
  --format="table(quotas.metric,quotas.limit,quotas.usage)"

# Vertex AI APIのquotaのみ
gcloud alpha services quotas list \
  --service=aiplatform.googleapis.com \
  --project=hackason-grab
```

---

## トラブルシューティング

### エラーが継続する場合

1. **ログを確認**
   ```bash
   # Cloud Runログを確認
   gcloud run logs read agent-api --project=hackason-grab --limit=100
   ```

2. **リトライが機能しているか確認**
   - ログに「Retry attempt X/3」が表示されるか確認

3. **quotaの適用を確認**
   - Google Cloud Consoleで変更が反映されているか確認
   - 数分待ってから再度テスト

4. **サポートに問い合わせ**
   - Google Cloud Supportに連絡
   - または、Slackチャンネルでエスカレーション

---

## 参考リンク

- [Vertex AI quotas and limits](https://cloud.google.com/vertex-ai/docs/quotas)
- [Gemini API rate limits](https://cloud.google.com/vertex-ai/generative-ai/docs/quotas)
- [Requesting a quota increase](https://cloud.google.com/docs/quota#requesting_higher_quota)
