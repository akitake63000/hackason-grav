# システム全体コードレビュー報告書

> **実施日**: 2026-02-15
> **実施方法**: Codex CLI による全自動コードレビュー
> **対象範囲**: フロントエンド、バックエンド、インフラ、Cloud Functions

---

## Executive Summary

システム全体のセキュリティ、パフォーマンス、コード品質、アーキテクチャの観点から包括的なレビューを実施しました。

**重要な発見**:
- **Critical Issues**: 2件（即座の対応が必要）
- **High Priority**: 5件（早急な対応が必要）
- **Medium/Low Priority**: 6件（改善推奨）

最も重大な問題は、ストレージパスの所有者検証の欠如とCloud Functionの認証不備です。

---

## Critical Issues（即座に対応が必要）

### 1. ストレージパス検証の欠如

**ファイル**: `services/agent-api/app/routers/lifestyle.py:1617`

**問題**: `storagePath`がユーザー入力のままAdmin権限で読み込まれており、所有者・パス検証が行われていない

**影響**:
- IDOR（Insecure Direct Object Reference）脆弱性
- 他ユーザーの画像や任意のStorageオブジェクトの読み取りが可能
- 機密情報の漏えいリスク

**推奨対応**:
```python
# services/agent-api/app/routers/lifestyle.py
from fastapi import HTTPException
from ..storage import validate_storage_path, download_image_bytes

def _assert_meal_path(uid: str, storage_path: str) -> None:
    validate_storage_path(storage_path)
    if not storage_path.startswith(f"users/{uid}/meals/"):
        raise HTTPException(status_code=403, detail="Invalid storage path")

@router.post("/meal-analyze", response_model=MealAnalyzeResponse)
def meal_analyze(...):
    _assert_meal_path(uid, req.storagePath)
    image_bytes = download_image_bytes(req.storagePath)
```

**優先度**: 🔴 **最高**（即座の対応が必要）

---

### 2. Cloud Functionの認証不備

**ファイル**: `cloud-functions/daily-scheduler/main.py:27`

**問題**: HTTP Cloud Functionが認証/署名検証なしで公開されている

**影響**:
- 誰でも全ユーザーのログとアクションを更新可能
- データ改ざん、DoS攻撃のリスク
- 悪意ある第三者による大量実行によるコスト増

**推奨対応**:
```python
# cloud-functions/daily-scheduler/main.py
import os
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

ALLOWED_SA = {os.getenv("SCHEDULER_SA_EMAIL")}

def _verify_scheduler(request) -> bool:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return False
    token = auth.split(" ", 1)[1]
    info = id_token.verify_oauth2_token(
        token,
        google_requests.Request(),
        audience=os.getenv("SCHEDULER_AUDIENCE"),
    )
    return info.get("email") in ALLOWED_SA

@functions_framework.http
def daily_scheduler(request):
    if not _verify_scheduler(request):
        return ("unauthorized", 401)
    # ... 既存の処理
```

**追加設定**:
- Cloud Schedulerのサービスアカウントを作成
- `SCHEDULER_SA_EMAIL`環境変数に設定
- IAMで該当Cloud Functionへのアクセスを制限

**優先度**: 🔴 **最高**（即座の対応が必要）

---

## High Priority（早急に対応すべき）

### 3. LLMエンドポイントのレート制限不足

**ファイル**:
- `services/agent-api/app/routers/food_sniper.py:934` (`/recommend`)
- `services/agent-api/app/routers/food_sniper.py:1054` (`/recipe`)

**問題**: Gemini APIを呼び出すエンドポイントにレート制限が設定されていない

**影響**:
- 悪意のあるユーザーによるAPI乱用
- Gemini APIのコスト増大
- レスポンス速度の低下、サービス品質の劣化

**推奨対応**:
```python
@router.post("/recommend", response_model=FoodSniperResponse)
@limiter.limit("10/minute")
def recommend_food_sniper(...):
    ...

@router.post("/recipe", response_model=RecipeResponse)
@limiter.limit("10/minute")
def generate_recipe(...):
    ...
```

**優先度**: 🟠 **高**

---

### 4. Firestoreデータモデルの不整合（reports）

**ファイル**:
- Backend: `services/agent-api/app/routers/reports.py:197`
- Frontend: `apps/web/src/lib/paths.ts:7`

**問題**: バックエンドは`reports/{uid}/items`に保存するが、フロントエンドとFirestore Rulesは`users/{uid}/reports`を想定

**影響**:
- フロントエンドから直接参照・削除できない
- アカウント削除時にデータが残留する可能性
- 運用上の混乱、データガバナンスの欠如

**推奨対応**:
```python
# services/agent-api/app/routers/reports.py
db.collection("users").document(uid).collection("reports").document(report_id).set(...)
```

**移行スクリプト**: 既存データの移行が必要

**優先度**: 🟠 **高**

---

### 5. Firestoreデータモデルの不整合（foodRequests）

**ファイル**:
- Backend: `services/agent-api/app/routers/food_sniper.py:1038`
- Frontend: `apps/web/src/lib/paths.ts:14`

**問題**: バックエンドは`foodRequests/{uid}/items`に保存するが、フロントエンドとFirestore Rulesは`users/{uid}/foodRequests`を想定

**影響**:
- フロントエンドから直接参照・削除できない
- アカウント削除時にデータが残留する可能性
- 監査性の低下

**推奨対応**:
```python
# services/agent-api/app/routers/food_sniper.py
db.collection("users").document(uid).collection("foodRequests").document(request_id).set(...)
```

**移行スクリプト**: 既存データの移行が必要

**優先度**: 🟠 **高**

---

### 6. エラーレスポンスの内部情報露出

**ファイル**: `services/agent-api/app/error_handler.py:123`

**問題**: Firebase/GCPの生のエラーメッセージをクライアントに返却している

**影響**:
- 内部構造の露出（プロジェクトID、権限情報、リソース名など）
- 攻撃者に有用な情報を提供

**推奨対応**:
```python
def handle_firebase_error(error: FirebaseError, request_id: str | None = None):
    logger.exception("Firebase error", exc_info=error)
    return create_error_response(
        ErrorCode.DATABASE_ERROR,
        "Firebase operation failed",
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        None,
        request_id
    )
```

**原則**: クライアントには汎用的なエラーメッセージのみを返し、詳細はサーバーログに記録

**優先度**: 🟠 **高**

---

### 7. Cloud Functionのスケーラビリティ問題

**ファイル**: `cloud-functions/daily-scheduler/main.py:85`

**問題**: 全ユーザー×全プランを逐次走査しており、上限がない

**影響**:
- ユーザー数増加によるタイムアウトリスク
- Cloud Functionの実行時間超過（最大9分）
- コスト増大

**推奨対応**:
- Collection Groupクエリで絞り込み（`status == "active"`など）
- Cloud Tasksで分割実行
- Pub/Subでバッチ処理

**優先度**: 🟠 **高**（ユーザー数が増えると顕在化）

---

## Medium/Low Priority（改善推奨）

### 8. LLM応答のログ出力による情報漏えいリスク

**ファイル**:
- `services/agent-api/app/services/gemini_vision.py:132`
- `services/agent-api/app/services/gemini_vision.py:173`

**問題**: Gemini APIの応答全文をログに出力、例外詳細を`notes`フィールドでクライアントに返却

**影響**:
- 画像由来の個人情報（PII）がログに記録される可能性
- 内部エラーの詳細がクライアントに露出

**推奨対応**:
- ログは応答の長さやメタ情報のみに制限
- エラーメッセージは抽象化

**優先度**: 🟡 **中**

---

### 9. healthエンドポイントの情報露出

**ファイル**: `services/agent-api/app/routers/health.py:9`

**問題**: 環境名、Gemini有効可否などの内部情報を公開

**影響**: 攻撃者に有用な情報を提供

**推奨対応**: 本番環境では非公開、または管理者のみアクセス可能に

**優先度**: 🟡 **中**

---

### 10. Firestoreスキーマ検証の欠如

**ファイル**: `firestore.rules:1`

**問題**: `/users/{uid}`配下でフィールド・型のバリデーションが行われていない

**影響**: 不正データ・想定外のフィールドが混入する可能性

**推奨対応**: 主要ドキュメント（profile, photos等）のみでもスキーマ検証を追加

**優先度**: 🟡 **中**

---

### 11. データ削除の効率性問題

**ファイル**: `services/agent-api/app/routers/lifestyle.py:2584`

**問題**: アカウント削除時にドキュメントを逐次削除している（バッチ削除なし）

**影響**: 大量データ保有ユーザーの削除で時間超過の可能性

**推奨対応**: Firebase Admin SDKの`recursive_delete`またはバッチ削除を利用

**優先度**: 🟡 **中**

---

### 12. CSP（Content Security Policy）未設定

**ファイル**: `firebase.json:25`

**問題**: CSPヘッダーが設定されていない

**影響**: XSS攻撃への耐性が弱い

**推奨対応**: 最低限のCSPを追加

```json
{
  "headers": [
    {
      "source": "**",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
        }
      ]
    }
  ]
}
```

**優先度**: 🟡 **中**

---

### 13. テストカバレッジの欠如

**問題**: `apps/web/src`および`services/agent-api/app`にテストファイルが見当たらない

**影響**: リグレッションリスク、品質保証の困難

**推奨対応**:
- 主要APIエンドポイントの統合テスト
- Firestore Rulesのユニットテスト
- フロントエンドのコンポーネントテスト

**優先度**: 🟡 **中～低**

---

## Good Practices（評価できる点）

以下の実装は高く評価できます：

1. ✅ **Storage Rules**: サイズ・Content-Type制限が適切に設定されている
2. ✅ **入力バリデーション**: Pydantic、regex、長さ制限が広く導入されている
3. ✅ **例外ハンドリング**: Sentry連携が整備されている
4. ✅ **レート制限**: 設計が実装済み（一部エンドポイントで追加が必要）
5. ✅ **N+1回避**: `analysis-history`でバッチ取得を実施

---

## 対応優先度マトリクス

| 優先度 | 項目 | 対応期限目安 |
|-------|------|------------|
| 🔴 最高 | ストレージパス検証の欠如 | 即座 |
| 🔴 最高 | Cloud Functionの認証不備 | 即座 |
| 🟠 高 | LLMエンドポイントのレート制限不足 | 1週間以内 |
| 🟠 高 | Firestoreデータモデルの不整合（reports） | 1週間以内 |
| 🟠 高 | Firestoreデータモデルの不整合（foodRequests） | 1週間以内 |
| 🟠 高 | エラーレスポンスの内部情報露出 | 1週間以内 |
| 🟠 高 | Cloud Functionのスケーラビリティ問題 | 2週間以内 |
| 🟡 中 | その他Medium/Low Priority | 1ヶ月以内 |

---

## 次のステップ

1. **即座の対応**:
   - [ ] lifestyle.py:1617のストレージパス検証を実装
   - [ ] Cloud Functionに認証を追加

2. **1週間以内**:
   - [ ] LLMエンドポイントにレート制限を追加
   - [ ] Firestoreデータモデルの統一（移行計画を作成）
   - [ ] エラーハンドリングの見直し

3. **2週間以内**:
   - [ ] Cloud Functionのスケーラビリティ改善

4. **継続的改善**:
   - [ ] テストカバレッジの向上
   - [ ] CSPの追加
   - [ ] ログ出力の見直し

---

## 補足事項

- **Admin SDKの特性**: Admin SDKはFirestore Rulesをバイパスするため、サーバー側での所有者検証が必須
- **Cloud Functionの公開状態**: 現在公開エンドポイントである前提で指摘（IAM制限済みなら影響は軽減）
- **データ移行**: reportsとfoodRequestsの統一には既存データの移行スクリプトが必要

---

**実施者**: Claude Code + Codex CLI
**レビュー時間**: 約15分（完全自動）
**使用トークン**: 254,900トークン
