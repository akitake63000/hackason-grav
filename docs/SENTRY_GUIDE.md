# Sentry エラー監視ガイド

このガイドでは、Sentryダッシュボードの使い方と、HairGuard Agent APIのエラー監視方法を説明します。

## 📍 Sentryダッシュボードへのアクセス

1. **Sentryにログイン**
   - URL: https://sentry.io/
   - 登録時のメールアドレス/パスワードでログイン

2. **プロジェクトを選択**
   - ログイン後、プロジェクト一覧が表示されます
   - **"hackason-grab-agent-api"** をクリック

---

## 🏠 ダッシュボードの構成

### メイン画面（Overview）

ログイン直後に表示される画面です。

```
┌─────────────────────────────────────────────────┐
│ hackason-grab-agent-api                         │
├─────────────────────────────────────────────────┤
│                                                 │
│  📊 Error Rate     📈 Transactions     ⏱️ Perf  │
│                                                 │
│  [グラフ: エラー発生数の推移]                      │
│                                                 │
│  Recent Issues:                                 │
│  🔴 TypeError: Cannot read property 'x' of...   │
│  🟡 HTTPException: 404 Not Found                │
│  🟢 ValueError: Invalid input                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

**確認できる情報**:
- エラー発生率（Error Rate）
- トランザクション数（API呼び出し数）
- 最近のエラー一覧

---

## 🐛 Issues（エラー一覧）

左サイドバーの **"Issues"** をクリックすると、エラーの一覧が表示されます。

### Issuesページの見方

```
┌─────────────────────────────────────────────────────────────┐
│ Issues                                    [Search] [Filter]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 🔴 TypeError: Cannot read property 'photoId'               │
│    Last seen: 5 minutes ago | 15 events | 3 users          │
│    → app/routers/photos.py in analyze_photo                │
│                                                             │
│ 🟡 HTTPException: 404 Not Found                             │
│    Last seen: 2 hours ago | 8 events | 2 users             │
│    → app/routers/reports.py in generate_report             │
│                                                             │
│ 🟢 Resolved: ValueError: Invalid date format                │
│    Resolved 1 day ago                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**エラーの重要度**:
- 🔴 **Unresolved**: 未解決（対応必要）
- 🟡 **Ongoing**: 継続中（監視中）
- 🟢 **Resolved**: 解決済み

**各エラーの情報**:
- **Last seen**: 最後に発生した時刻
- **Events**: 発生回数
- **Users**: 影響を受けたユーザー数
- **Location**: エラーが発生したコードの場所

---

## 🔍 エラー詳細の確認

エラーをクリックすると、詳細画面が表示されます。

### 詳細画面の構成

#### 1. スタックトレース

```python
Traceback (most recent call last):
  File "app/routers/photos.py", line 42, in analyze_photo
    photo_id = request.photoId  ← ここでエラー発生
TypeError: Cannot read property 'photoId' of undefined
```

**確認すべきこと**:
- どのファイル・行でエラーが発生したか
- エラーの種類（TypeError, ValueError, HTTPException等）
- エラーメッセージ

#### 2. ブレッドクラム（Breadcrumbs）

エラー発生前の処理履歴が表示されます。

```
15:30:45.123 | HTTP Request | POST /api/v1/photos/analyze
15:30:45.456 | Database Query | SELECT * FROM photos WHERE id=...
15:30:45.789 | Error | TypeError: Cannot read property 'photoId'
```

**何がわかるか**:
- エラーが発生するまでの処理の流れ
- どのAPIエンドポイントで発生したか
- データベースクエリなどの操作履歴

#### 3. タグ（Tags）

エラーに付与された情報タグです。

```
environment: production
release: v1.0.0
server_name: agent-api-7wsihnjf7q-an.a.run.app
user.id: user_123456
```

**確認すべきタグ**:
- `environment`: 環境（production/staging）
- `release`: リリースバージョン
- `user.id`: 影響を受けたユーザーID

#### 4. コンテキスト（Context）

エラー発生時の追加情報です。

```json
{
  "request": {
    "url": "https://agent-api.../api/v1/photos/analyze",
    "method": "POST",
    "headers": {
      "User-Agent": "Mozilla/5.0...",
      "Content-Type": "application/json"
    },
    "data": {
      "photoId": null  ← 原因: photoIdがnull
    }
  }
}
```

---

## 📈 Performance（パフォーマンス監視）

左サイドバーの **"Performance"** をクリックすると、APIのパフォーマンスが確認できます。

### Performanceページの見方

```
┌─────────────────────────────────────────────────────────┐
│ Performance                                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Average Response Time: 245ms                           │
│                                                         │
│  [グラフ: レスポンスタイムの推移]                         │
│                                                         │
│  Slowest Transactions:                                  │
│  POST /api/v1/photos/analyze      - 1,234ms  (遅い!)   │
│  POST /api/v1/reports/generate    - 892ms              │
│  GET /api/v1/photos/analysis-history - 125ms           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**確認すべきこと**:
- 平均レスポンスタイム
- 遅いエンドポイント（最適化が必要）
- レスポンスタイムの推移

---

## 🔔 アラート設定

エラーが発生したときに通知を受け取る設定をします。

### アラート設定手順

1. **Settings（設定）を開く**
   - 左サイドバー下部の「Settings」をクリック
   - 「Alerts」を選択

2. **新しいアラートルールを作成**
   - 「Create Alert Rule」ボタンをクリック

3. **アラート条件を設定**

   ```
   Alert me when:
   - An issue is first seen
   - The issue is reopened
   - An issue exceeds 10 events in 1 minute

   For these environments:
   - production (本番環境のみ)
   ```

4. **通知先を設定**
   - Email: あなたのメールアドレス
   - Slack: （オプション）Slackワークスペースに通知

5. **保存**
   - 「Save Rule」をクリック

### 推奨アラート設定

| 条件 | 重要度 | 通知先 |
|------|--------|--------|
| 新しいエラーが発生 | High | Email + Slack |
| 1分間に10回以上同じエラー | Critical | Email + Slack |
| エラーが再発生 | Medium | Email |

---

## 🔍 エラーの対応フロー

### 1. エラーを発見

```
Sentryから通知 → ダッシュボードでエラー確認
```

### 2. エラーの詳細を確認

- **スタックトレース**: どこでエラーが発生したか
- **ブレッドクラム**: エラーに至る処理の流れ
- **コンテキスト**: リクエスト内容やユーザー情報

### 3. 原因を特定

- エラーメッセージを読む
- 該当するコードを確認（ファイル名と行番号が表示される）
- ブレッドクラムで処理の流れを追う

### 4. 修正

- ローカル環境で再現
- コードを修正
- テストを実行

### 5. デプロイ

- 修正をmainブランチにマージ
- Cloud Runに自動デプロイ

### 6. エラーをResolve（解決済みにする）

- Sentryのエラー詳細画面で「Resolve」ボタンをクリック
- 解決方法をコメントに記載（推奨）

---

## 📊 よく使う機能

### 1. Search & Filter（検索とフィルタ）

Issuesページの検索ボックスで、エラーを絞り込めます。

**例**:
```
environment:production         # 本番環境のみ
level:error                    # エラーレベルのみ
is:unresolved                  # 未解決のみ
user.id:user_123456            # 特定ユーザーのエラー
```

### 2. Merge Issues（エラーの統合）

同じ原因のエラーが複数ある場合、統合できます。

1. 統合したいエラーを選択（チェックボックス）
2. 上部の「Merge」ボタンをクリック

### 3. Ignore（無視）

特定のエラーを無視する設定ができます。

**使用例**:
- 既知の問題で対応予定がない
- テストトラフィックからのエラー

**設定方法**:
1. エラー詳細画面で「Ignore」ボタン
2. 無視する条件を設定（期間、回数など）

---

## 🚀 実際の確認フロー

### デプロイ直後のチェック

1. **Sentryダッシュボードを開く**
   - https://sentry.io/organizations/your-org/projects/hackason-grab-agent-api/

2. **Issuesページで新しいエラーを確認**
   - 左サイドバー → Issues
   - フィルタ: `environment:production is:unresolved`

3. **Performanceページでレスポンスタイムを確認**
   - 左サイドバー → Performance
   - 遅いエンドポイントがないか確認

### 毎日のチェック（推奨）

- **朝9:00頃**: 昨日発生したエラーを確認
- **夕方17:00頃**: 今日発生したエラーを確認

**チェックリスト**:
- [ ] 新しいエラーはないか？
- [ ] エラー発生率は増加していないか？
- [ ] 特定のユーザーで頻発していないか？
- [ ] レスポンスタイムは正常範囲か？

---

## 💡 Tips

### Tip 1: Release Tracking（リリース追跡）

デプロイごとにリリースバージョンを記録すると、どのデプロイでエラーが発生したかわかります。

現在の設定では自動的に `ENVIRONMENT=production` が記録されます。

### Tip 2: Source Maps（ソースマップ）

Pythonの場合、スタックトレースにはソースコードが表示されます。
GitHubリポジトリと連携すると、エラー箇所のコードを直接確認できます。

**設定方法**:
1. Settings → Integrations → GitHub
2. リポジトリを連携

### Tip 3: Custom Context（カスタムコンテキスト）

コードから追加の情報を送信できます。

```python
from app.monitoring import capture_exception

try:
    # 処理
    result = process_photo(photo_id)
except Exception as e:
    # カスタムコンテキストを追加
    capture_exception(e, context={
        "photo_id": photo_id,
        "user_id": user_id,
        "operation": "analyze_photo"
    })
    raise
```

---

## 🆘 トラブルシューティング

### Q1: エラーがSentryに表示されない

**確認事項**:
1. Cloud Runの環境変数 `SENTRY_DSN` が設定されているか
   ```bash
   gcloud run services describe agent-api --region=asia-northeast1 --format="value(spec.template.spec.containers[0].env)"
   ```

2. アプリケーションログで Sentry初期化を確認
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND textPayload=~'Sentry'" --limit 10
   ```

### Q2: プライバシー情報が含まれている

Sentryは現在 `send_default_pii=False` に設定されており、個人情報は送信されません。

もし個人情報が含まれる場合は、Data Scrubbing設定を確認：
1. Settings → Security & Privacy
2. Data Scrubbing を有効化

### Q3: エラー通知が多すぎる

**対策**:
1. アラートルールを調整
   - Settings → Alerts → ルールを編集
   - 閾値を変更（例: 10回 → 50回）

2. エラーを統合
   - 同じ原因のエラーをMerge

3. 特定のエラーを無視
   - エラー詳細 → Ignore

---

## 📚 参考リンク

- **Sentry公式ドキュメント**: https://docs.sentry.io/
- **FastAPI統合ガイド**: https://docs.sentry.io/platforms/python/guides/fastapi/
- **トラブルシューティング**: https://docs.sentry.io/platforms/python/troubleshooting/

---

## 🎯 最初にやること（チェックリスト）

デプロイが完了したら、以下を確認してください：

- [ ] Sentryダッシュボードにアクセスできる
- [ ] プロジェクト "hackason-grab-agent-api" が表示される
- [ ] Issuesページでエラーが表示される（あれば）
- [ ] アラート設定を確認（Email通知が有効か）
- [ ] Performanceページでトランザクションが記録されている

すべて完了すれば、エラー監視の準備完了です！🎉
