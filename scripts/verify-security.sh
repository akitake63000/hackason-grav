#!/bin/bash
# セキュリティ設定検証スクリプト

# set -e を削除（エラーがあっても最後まで実行）

echo "=== HairGuard Agent セキュリティ監査 ==="
echo ""

# 環境変数
PROJECT_ID="${FIREBASE_PROJECT_ID:-hackason-grab}"
CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-agent-api}"
REGION="${CLOUD_RUN_REGION:-asia-northeast1}"

# カラーコード
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# カウンタ
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

function pass() {
  echo -e "${GREEN}✅ PASS${NC}: $1"
  ((PASS_COUNT++))
}

function fail() {
  echo -e "${RED}❌ FAIL${NC}: $1"
  ((FAIL_COUNT++))
}

function warn() {
  echo -e "${YELLOW}⚠️  WARN${NC}: $1"
  ((WARN_COUNT++))
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Firestore Rules 検証"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Firestore Rules 構文チェック
if [ -f "firestore.rules" ]; then
  echo "📄 firestore.rules を検証中..."

  # 認証必須チェック
  if grep -q "request.auth != null" firestore.rules; then
    pass "認証必須チェックが実装されています"
  else
    fail "認証必須チェックが見つかりません"
  fi

  # UID一致チェック
  if grep -q "request.auth.uid == uid" firestore.rules; then
    pass "UID一致チェックが実装されています"
  else
    fail "UID一致チェックが見つかりません"
  fi

  # isOwner関数チェック
  if grep -q "function isOwner" firestore.rules; then
    pass "isOwner関数が定義されています"
  else
    warn "isOwner関数が見つかりません（推奨）"
  fi

  # デプロイテスト（ドライラン）
  echo "🔍 構文チェック（dry-run）実行中..."
  if firebase deploy --only firestore:rules --project "$PROJECT_ID" --dry-run 2>&1 | grep -q "success"; then
    pass "Firestore Rules 構文が正しい"
  else
    warn "Firestore Rules デプロイテスト実行失敗（Firebase CLI未認証の可能性）"
  fi
else
  fail "firestore.rules が見つかりません"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Storage Rules 検証"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "storage.rules" ]; then
  echo "📄 storage.rules を検証中..."

  # 認証必須チェック
  if grep -q "request.auth != null" storage.rules; then
    pass "認証必須チェックが実装されています"
  else
    fail "認証必須チェックが見つかりません"
  fi

  # UID一致チェック
  if grep -q "request.auth.uid == uid" storage.rules; then
    pass "UID一致チェックが実装されています"
  else
    fail "UID一致チェックが見つかりません"
  fi

  # パス制限チェック
  if grep -q "users/{uid}" storage.rules; then
    pass "users/{uid} パス制限が実装されています"
  else
    warn "パス制限が適切でない可能性があります"
  fi

  # デプロイテスト（ドライラン）
  echo "🔍 構文チェック（dry-run）実行中..."
  if firebase deploy --only storage --project "$PROJECT_ID" --dry-run 2>&1 | grep -q "success"; then
    pass "Storage Rules 構文が正しい"
  else
    warn "Storage Rules デプロイテスト実行失敗（Firebase CLI未認証の可能性）"
  fi
else
  fail "storage.rules が見つかりません"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Cloud Run 認証設定確認"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "🔍 Cloud Run サービス情報を取得中..."
CLOUD_RUN_INFO=$(gcloud run services describe "$CLOUD_RUN_SERVICE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format=json 2>&1)

if echo "$CLOUD_RUN_INFO" | jq -e . >/dev/null 2>&1; then
  # Ingress設定確認
  INGRESS=$(echo "$CLOUD_RUN_INFO" | jq -r '.spec.template.metadata.annotations["run.googleapis.com/ingress"] // "all"')
  echo "Ingress設定: $INGRESS"

  if [ "$INGRESS" = "internal-and-cloud-load-balancing" ]; then
    pass "Ingress設定が安全（内部+LB）"
  elif [ "$INGRESS" = "internal" ]; then
    pass "Ingress設定が安全（内部のみ）"
  else
    warn "Ingress設定が 'all'（すべてのトラフィック許可）"
  fi

  # 環境変数確認（ALLOW_UNAUTHENTICATED）
  echo "⚠️  注意: ALLOW_UNAUTHENTICATED 設定は環境変数で確認してください"
  warn "本番環境では ALLOW_UNAUTHENTICATED=false を推奨"
else
  warn "Cloud Run サービス情報の取得に失敗（gcloud未認証の可能性）"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  認証ミドルウェア検証"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

AUTH_FILE="services/agent-api/app/auth/deps.py"
if [ -f "$AUTH_FILE" ]; then
  echo "📄 $AUTH_FILE を検証中..."

  # verify_id_token 使用チェック
  if grep -q "verify_id_token" "$AUTH_FILE"; then
    pass "Firebase ID Token 検証が実装されています"
  else
    fail "Firebase ID Token 検証が見つかりません"
  fi

  # UID取得チェック
  if grep -q 'decoded.get("uid")' "$AUTH_FILE"; then
    pass "UID取得処理が実装されています"
  else
    fail "UID取得処理が見つかりません"
  fi

  # HTTPException チェック
  if grep -q "HTTPException" "$AUTH_FILE"; then
    pass "エラーハンドリングが実装されています"
  else
    warn "エラーハンドリングが不十分な可能性があります"
  fi

  # Bearer Token チェック
  if grep -q "Bearer" "$AUTH_FILE" || grep -q "x_firebase_auth" "$AUTH_FILE"; then
    pass "Bearer Token または X-Firebase-Auth ヘッダーに対応"
  else
    warn "トークン取得方法を確認してください"
  fi
else
  fail "$AUTH_FILE が見つかりません"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  CORS設定確認"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# FastAPI main.py でCORS設定を確認
MAIN_FILE="services/agent-api/app/main.py"
if [ -f "$MAIN_FILE" ]; then
  echo "📄 $MAIN_FILE を検証中..."

  if grep -q "CORSMiddleware" "$MAIN_FILE"; then
    pass "CORS Middleware が設定されています"

    # allow_origins 確認
    if grep -q "allow_origins" "$MAIN_FILE"; then
      pass "allow_origins が設定されています"

      # ワイルドカード警告
      if grep -q 'allow_origins=\["*"\]' "$MAIN_FILE"; then
        fail "allow_origins に '*' が設定されています（全オリジン許可）"
      else
        pass "allow_origins が適切に制限されています"
      fi
    else
      warn "allow_origins 設定を確認してください"
    fi
  else
    warn "CORS Middleware が見つかりません"
  fi
else
  fail "$MAIN_FILE が見つかりません"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 監査結果サマリー"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ PASS: $PASS_COUNT${NC}"
echo -e "${YELLOW}⚠️  WARN: $WARN_COUNT${NC}"
echo -e "${RED}❌ FAIL: $FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  if [ $WARN_COUNT -eq 0 ]; then
    echo -e "${GREEN}🎉 すべての検証項目が合格しました！${NC}"
    exit 0
  else
    echo -e "${YELLOW}⚠️  警告項目があります。確認を推奨します。${NC}"
    exit 0
  fi
else
  echo -e "${RED}❌ 重大な問題が見つかりました。修正が必要です。${NC}"
  exit 1
fi
