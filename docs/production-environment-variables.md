# 本番環境変数設定ガイド

本番環境（Cloud Run）で必要な環境変数の設定ガイドです。

## 必須環境変数

### 1. CLOUD_TASKS_SA_EMAIL

**目的**: Cloud Tasks実行エンドポイントのOIDC認証

**説明**:
- `/api/v1/mental-shield/tasks/{task_id}/execute` エンドポイントへのアクセスを認証するために使用
- Cloud Tasksサービスアカウントのメールアドレスを設定
- 未設定の場合、OIDC認証がスキップされセキュリティリスクあり

**設定方法**:
```bash
# Cloud Runサービスの環境変数として設定
gcloud run services update agent-api \
  --region=asia-northeast1 \
  --set-env-vars="CLOUD_TASKS_SA_EMAIL=cloud-tasks-invoker@hackason-grab.iam.gserviceaccount.com" \
  --project=hackason-grab
```

**確認箇所**: `services/agent-api/app/routers/mental_shield.py:55`

---

### 2. CLOUD_TASKS_AUDIENCE

**目的**: Cloud Tasks OIDC トークンのオーディエンス検証

**説明**:
- OIDC トークンの `aud` クレームを検証するために使用
- 通常は Cloud Run サービスの URL を設定

**設定方法**:
```bash
gcloud run services update agent-api \
  --region=asia-northeast1 \
  --set-env-vars="CLOUD_TASKS_AUDIENCE=https://agent-api-XXXXX-an.a.run.app" \
  --project=hackason-grab
```

**確認箇所**: `services/agent-api/app/routers/mental_shield.py:66`

---

### 3. SCHEDULER_SA_EMAIL

**目的**: Cloud Scheduler実行エンドポイントのOIDC認証

**説明**:
- `/daily-scheduler` Cloud Function へのアクセスを認証するために使用
- Cloud Schedulerサービスアカウントのメールアドレスを設定
- 未設定の場合、OIDC認証がスキップされセキュリティリスクあり

**設定方法**:
```bash
# Cloud Functionの環境変数として設定
gcloud functions deploy daily-scheduler \
  --region=asia-northeast1 \
  --set-env-vars="SCHEDULER_SA_EMAIL=scheduler-invoker@hackason-grab.iam.gserviceaccount.com" \
  --project=hackason-grab
```

**確認箇所**: `cloud-functions/daily-scheduler/main.py:14`

**ステータス**: ✅ 設定済み

---

## 推奨環境変数

### 4. TRUSTED_PROXIES

**目的**: レート制限の誤検知防止

**説明**:
- Cloud Run や Load Balancer の IP アドレスをカンマ区切りで設定
- 未設定の場合、ロードバランサー経由のリクエストが全て同一IPと見なされ、レート制限が誤動作する可能性あり
- `slowapi` / `limiter` がクライアントの実際のIPアドレスを正しく取得するために必要

**設定方法**:
```bash
# Cloud Runのロードバランサー/プロキシIPを設定
gcloud run services update agent-api \
  --region=asia-northeast1 \
  --set-env-vars="TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16" \
  --project=hackason-grab
```

**確認箇所**:
- `services/agent-api/app/middleware/rate_limit.py:39`
- `services/agent-api/app/middleware/rate_limit.py:69`

---

## 環境変数の確認方法

### Cloud Runサービスの環境変数確認

```bash
gcloud run services describe agent-api \
  --region=asia-northeast1 \
  --project=hackason-grab \
  --format="value(spec.template.spec.containers[0].env)"
```

### Cloud Functionの環境変数確認

```bash
gcloud functions describe daily-scheduler \
  --region=asia-northeast1 \
  --project=hackason-grab \
  --format="value(environmentVariables)"
```

---

## チェックリスト

本番環境デプロイ前に以下を確認してください：

- [ ] `CLOUD_TASKS_SA_EMAIL` が設定されている
- [ ] `CLOUD_TASKS_AUDIENCE` が設定されている（Cloud Run サービスURL）
- [ ] `SCHEDULER_SA_EMAIL` が設定されている
- [ ] `TRUSTED_PROXIES` が設定されている（推奨）
- [ ] 各サービスアカウントに適切なIAMロールが付与されている
  - Cloud Tasks SA: `roles/run.invoker`
  - Cloud Scheduler SA: `roles/cloudfunctions.invoker`

---

## トラブルシューティング

### OIDC認証がスキップされる

**症状**: ログに "No CLOUD_TASKS_SA_EMAIL configured, skipping OIDC auth check" が出力される

**原因**: 環境変数が未設定

**対処**: 上記の設定方法に従って環境変数を設定し、サービスを再デプロイ

### レート制限が誤動作する

**症状**: 異なるユーザーからのリクエストが同一IPと見なされ、すぐにレート制限に達する

**原因**: `TRUSTED_PROXIES` が未設定で、ロードバランサーのIPがクライアントIPとして使用されている

**対処**: `TRUSTED_PROXIES` を設定し、サービスを再デプロイ

### 🚨 DEBUG_AUTH が本番環境で有効になっている

**症状**: 認証エラー時にログに「DEBUG_AUTH is enabled」という警告が表示される

**原因**: 開発環境専用の `DEBUG_AUTH` が本番環境で有効化されている

**対処**:
1. `DEBUG_AUTH` 環境変数が設定されていないことを確認
2. `app/config.py` で `DEBUG_AUTH = False` がデフォルトであることを確認
3. 本番環境では **絶対に** `DEBUG_AUTH` を有効化しない

**セキュリティ注意**:
- DEBUG_AUTH は開発環境専用の設定です
- 本番環境で有効化すると、認証エラーの詳細がログに出力されます
- レスポンスには汎用メッセージのみが返却されるため、直接的な情報漏洩リスクは低減されていますが、ログからの情報漏洩リスクがあります

---

## 関連ドキュメント

- [Cloud Run 環境変数の設定](https://cloud.google.com/run/docs/configuring/environment-variables)
- [Cloud Functions 環境変数の設定](https://cloud.google.com/functions/docs/configuring/env-var)
- [OIDC 認証の仕組み](https://cloud.google.com/run/docs/securing/authenticating)
