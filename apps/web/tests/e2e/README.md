# E2E Tests

Playwright を使用したエンドツーエンドテストです。

## セットアップ

```bash
# 依存関係のインストール
npm ci

# Playwright ブラウザのインストール
npx playwright install --with-deps chromium firefox
```

## ローカル実行

### 開発サーバーを使用したテスト

```bash
# デフォルト（http://localhost:3000）
npm run test:e2e

# UI モードで実行（デバッグに便利）
npm run test:e2e:ui

# デバッグモードで実行
npm run test:e2e:debug
```

### 本番環境に対するテスト

```bash
# 環境変数を設定して実行
PLAYWRIGHT_TEST_BASE_URL=https://hackason-grab.web.app \
API_BASE_URL=https://agent-api-xxxxxxxx-an.a.run.app \
npm run test:e2e
```

## テストファイル

| ファイル | 内容 |
|---------|------|
| `api-health.spec.ts` | API ヘルスチェック、CORS、レスポンスタイム |
| `dashboard.spec.ts` | ダッシュボード画面のUI/UXテスト |
| `photo-analysis.spec.ts` | 写真分析機能のE2Eテスト |
| `security-fixes.spec.ts` | セキュリティ改修の検証テスト<br>- IDOR保護<br>- レート制限<br>- エラーサニタイズ<br>- OIDC認証<br>- データ削除API |

## CI/CD

GitHub Actions で自動実行されます：

- **トリガー**:
  - 手動実行（workflow_dispatch）
  - 毎日 9:00 AM JST（スケジュール実行）
  - Cloud Run デプロイ成功後

- **実行環境**:
  - Chromium & Firefox
  - Production環境

- **レポート**:
  - Playwright HTML レポート（Artifacts からダウンロード可能）
  - 30日間保存

## トラブルシューティング

### ブラウザが見つからない

```bash
npx playwright install --with-deps
```

### タイムアウトエラー

`playwright.config.ts` の `timeout` 設定を確認してください。

### 認証エラー

本番環境テストの場合、Firebase Authentication のトークンが必要です。

## ベストプラクティス

1. **独立性**: 各テストは他のテストに依存しない
2. **冪等性**: 同じテストを何度実行しても同じ結果
3. **クリーンアップ**: テスト後はデータをクリーンアップ
4. **並列実行**: `fullyParallel: true` で高速化
5. **リトライ**: CI では2回までリトライ
