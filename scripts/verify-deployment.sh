#!/bin/bash
# デプロイ検証スクリプト

set -e

echo "=== HairGuard Agent デプロイ検証 ==="
echo ""

# 環境変数確認
PROJECT_ID="${FIREBASE_PROJECT_ID:-hackason-grab}"
CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-agent-api}"
REGION="${CLOUD_RUN_REGION:-asia-northeast1}"

# 1. Firebase Hosting デプロイ状況確認
echo "✅ 1. Firebase Hosting 確認..."
firebase hosting:sites:list --project "$PROJECT_ID" 2>&1 || echo "❌ Firebase CLI 未認証または未インストール"

# 2. Cloud Run デプロイ状況確認
echo ""
echo "✅ 2. Cloud Run 確認..."
CLOUD_RUN_URL=$(gcloud run services describe "$CLOUD_RUN_SERVICE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format="value(status.url)" 2>&1)

if echo "$CLOUD_RUN_URL" | grep -q "^https://"; then
  echo "✅ Cloud Run URL: $CLOUD_RUN_URL"
else
  echo "❌ Cloud Run サービスが見つかりません: $CLOUD_RUN_URL"
  CLOUD_RUN_URL=""
fi

# 3. /api/health エンドポイント疎通確認
echo ""
echo "✅ 3. Health Endpoint 確認 (Cloud Run直接)..."
if [ -n "$CLOUD_RUN_URL" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUD_RUN_URL/api/health" 2>&1)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health check OK (HTTP $HTTP_CODE)"
  else
    echo "❌ Health check failed (HTTP $HTTP_CODE)"
  fi
else
  echo "⏭️  スキップ（Cloud Run URLが取得できませんでした）"
fi

# 4. Firebase Hosting URL確認
echo ""
echo "✅ 4. Firebase Hosting URL 確認..."
HOSTING_URL="https://$PROJECT_ID.web.app"
echo "Hosting URL: $HOSTING_URL"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HOSTING_URL" 2>&1)
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Hosting アクセス OK (HTTP $HTTP_CODE)"
else
  echo "❌ Hosting アクセス失敗 (HTTP $HTTP_CODE)"
fi

# 5. Rewrite動作確認（Hosting経由で/api/healthにアクセス）
echo ""
echo "✅ 5. Hosting → Cloud Run Rewrite 確認..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HOSTING_URL/api/health" 2>&1)
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Rewrite OK (HTTP $HTTP_CODE)"
else
  echo "❌ Rewrite failed (HTTP $HTTP_CODE)"
fi

echo ""
echo "=== 検証完了 ==="
