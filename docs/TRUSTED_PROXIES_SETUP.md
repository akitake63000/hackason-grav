# TRUSTED_PROXIES 環境変数設定ガイド

## 概要

`TRUSTED_PROXIES` 環境変数は、レート制限のIP検証で使用されます。この変数を設定することで、プロキシ・ロードバランサー経由のリクエストの実際のクライアントIPアドレスを正しく取得できます。

## セキュリティの重要性

**⚠️ 重要**: この設定を誤ると、レート制限を回避される可能性があります。

- **信頼できるプロキシのIPアドレスのみ**を設定してください
- 信頼できないIPアドレスを設定すると、攻撃者が `X-Forwarded-For` ヘッダーを偽装してレート制限を回避できます

## 環境別の設定方法

### 1. 開発環境（ローカル）

**ファイル**: `.env.local`

```bash
# ローカル開発環境ではプライベートIP範囲を使用（例）
TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

### 2. 本番環境（Cloud Run）

#### GitHub Secretsに設定

1. GitHubリポジトリの **Settings** → **Secrets and variables** → **Actions** に移動
2. **New repository secret** をクリック
3. 以下を設定：
   - **Name**: `TRUSTED_PROXIES`
   - **Value**: 実際のロードバランサー/プロキシのIPアドレス

#### 設定値の決定方法

**A. Cloud Load Balancerを使用している場合**

Google Cloud Load BalancerのIPアドレス範囲を設定します：

```bash
# Google Cloud Load Balancerの場合（例）
# 実際のIPアドレスはGCPコンソールで確認してください
TRUSTED_PROXIES=35.191.0.0/16,130.211.0.0/22
```

**B. Cloud Runを直接公開している場合**

設定不要です（空文字列のまま）：

```bash
TRUSTED_PROXIES=
```

この場合、`X-Forwarded-For` ヘッダーは信頼されず、直接接続のIPアドレスが使用されます。

**C. Cloudflareなどの外部CDNを使用している場合**

CDNのIPアドレス範囲を設定します：

```bash
# Cloudflareの場合（例）
TRUSTED_PROXIES=173.245.48.0/20,103.21.244.0/22,103.22.200.0/22
```

### 3. GitHub Actions設定の確認

`.github/workflows/cloud-run-deploy.yml` に以下が含まれていることを確認してください：

```yaml
env:
  TRUSTED_PROXIES: ${{ secrets.TRUSTED_PROXIES }}

# ...

--set-env-vars="...TRUSTED_PROXIES=${TRUSTED_PROXIES}|..."
```

## 設定フォーマット

### 単一IPアドレス
```bash
TRUSTED_PROXIES=10.0.0.1
```

### 複数IPアドレス（カンマ区切り）
```bash
TRUSTED_PROXIES=10.0.0.1,10.0.0.2,10.0.0.3
```

### CIDR範囲
```bash
TRUSTED_PROXIES=10.0.0.0/8
```

### 複数CIDR範囲（カンマ区切り）
```bash
TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

### 混在（IPアドレスとCIDR範囲）
```bash
TRUSTED_PROXIES=10.0.0.1,192.168.0.0/24,172.16.0.5
```

## 動作確認

### 設定が有効な場合

アプリケーション起動時にログに以下が表示されます：

```
INFO:app.middleware.rate_limit:Loaded trusted proxies: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']
```

### 設定が無効な場合（空文字列）

```
INFO:app.middleware.rate_limit:No trusted proxies configured. X-Forwarded-For will not be trusted.
```

### 不正な設定値の場合

```
WARNING:app.middleware.rate_limit:Invalid trusted proxy IP/CIDR: invalid-ip - ...
```

## トラブルシューティング

### レート制限が正常に動作しない

1. **Cloud Runログを確認**:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=YOUR_SERVICE_NAME" --limit 50
   ```

2. **TRUSTED_PROXIES設定を確認**:
   ```bash
   gcloud run services describe YOUR_SERVICE_NAME --region YOUR_REGION --format="value(spec.template.spec.containers[0].env)"
   ```

3. **実際のリクエストIPを確認**:
   アプリケーションログで `get_real_client_ip` の出力を確認

### 本番環境でIPが正しく取得できない

- ロードバランサー/プロキシのIPアドレスが `TRUSTED_PROXIES` に含まれているか確認
- `X-Forwarded-For` ヘッダーがリクエストに含まれているか確認

## セキュリティベストプラクティス

1. **最小権限の原則**: 必要最小限のIPアドレス範囲のみを信頼する
2. **定期的な見直し**: インフラ変更時にTRUSTED_PROXIESを更新する
3. **監視**: レート制限の回避試行を監視する

## 関連ファイル

- コード実装: `services/agent-api/app/middleware/rate_limit.py`
- デプロイ設定: `.github/workflows/cloud-run-deploy.yml`
- ローカル設定: `services/agent-api/.env.local`

## 参考リンク

- [Google Cloud Load Balancer IP ranges](https://cloud.google.com/load-balancing/docs/https#firewall-rules)
- [Cloudflare IP ranges](https://www.cloudflare.com/ips/)
- [X-Forwarded-For header specification](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For)
