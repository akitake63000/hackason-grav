# E2E Test Results - 確認方法

このドキュメントでは、GitHub Actionsで実行されるE2Eテストの結果確認方法を説明します。

## 📍 結果の確認場所

### 1. GitHub Actions UI

**手順**:
1. GitHubリポジトリにアクセス: https://github.com/akitake63000/hackason-grav
2. 上部メニューの「**Actions**」タブをクリック
3. 左サイドバーから「**E2E Tests (Production)**」ワークフローを選択
4. 最新の実行結果をクリック

**確認できる情報**:
- ✅/❌ テスト成功/失敗ステータス
- 実行時間
- ログ出力
- テストサマリー（Summary）

### 2. Playwright HTMLレポート（詳細）

**ダウンロード手順**:
1. GitHub Actions → E2E Tests (Production) → 実行結果を開く
2. 下部の「**Artifacts**」セクションを確認
3. `playwright-report-{run_number}` をダウンロード
4. ZIPファイルを解凍
5. `index.html` をブラウザで開く

**レポートの内容**:
- 各テストの詳細結果
- スクリーンショット（失敗時）
- ビデオ録画（失敗時）
- トレースファイル（デバッグ用）
- パフォーマンスメトリクス

### 3. Test Results（生データ）

**ダウンロード手順**:
1. Artifacts → `test-results-{run_number}` をダウンロード
2. ZIPファイル内に失敗したテストのスクリーンショット/動画

## 🔔 通知設定

### GitHub通知

デフォルトでは、ワークフロー失敗時にGitHubから通知が届きます。

**通知設定の確認**:
1. GitHub → Settings → Notifications
2. 「Actions」セクションで通知設定を確認

### Slack通知（オプション）

Slack通知を追加する場合は、以下を追加:

```yaml
- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v1.25.0
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "🚨 E2E Tests Failed!",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*E2E Tests Failed in Production*\n<${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View Details>"
            }
          }
        ]
      }
```

## 📊 テスト実行トリガー

### 1. 手動実行

**手順**:
1. GitHub → Actions → E2E Tests (Production)
2. 右上の「**Run workflow**」をクリック
3. ブランチを選択（通常はmain）
4. 「Run workflow」を実行

### 2. 自動実行（毎日）

- **実行時刻**: 毎日 9:00 AM JST（00:00 UTC）
- 自動で本番環境に対してテストを実行

### 3. デプロイ後自動実行

- Cloud Runへのデプロイが成功した後、自動的にE2Eテストを実行
- デプロイ直後に新機能が正常動作しているか確認

## 📈 テストサマリー

ワークフロー実行後、以下の情報が「Summary」タブに表示されます:

```
## E2E Test Results 🎭

- Test Run: #123
- Environment: Production
- Frontend URL: https://hackason-grab.web.app
- API URL: https://agent-api-7wsihnjf7q-an.a.run.app

### 📊 Download Reports
- View artifacts in the workflow run for detailed HTML reports
- Reports are retained for 30 days
```

## 🐛 トラブルシューティング

### テストが失敗した場合

1. **Playwright HTMLレポートをダウンロード**
   - 失敗したテストのスクリーンショット/動画を確認
   - エラーメッセージを確認

2. **ログを確認**
   - GitHub Actions → 該当ワークフロー → "Run E2E tests" ステップのログ

3. **ローカルで再現**
   ```bash
   cd apps/web
   PLAYWRIGHT_TEST_BASE_URL=https://hackason-grab.web.app \
   API_BASE_URL=https://agent-api-7wsihnjf7q-an.a.run.app \
   npm run test:e2e
   ```

### Artifactsが見つからない場合

- Artifactsは**30日間**保持されます
- それ以降は自動削除されるため、重要なレポートは早めにダウンロード

## 🔧 カスタマイズ

### 実行頻度を変更

`.github/workflows/e2e-tests-production.yml` の `schedule` を編集:

```yaml
schedule:
  # 毎日9:00 AM JST → 毎週月曜9:00 AM JSTに変更
  - cron: '0 0 * * 1'
```

### テスト対象ブラウザを変更

現在はChromiumとFirefoxのみ実行（高速化のため）。
WebKitを追加する場合:

```bash
npx playwright install --with-deps chromium firefox webkit
```

## 📞 サポート

- E2Eテストに関する問題: [Issue作成](https://github.com/akitake63000/hackason-grav/issues)
- Playwrightドキュメント: https://playwright.dev/
