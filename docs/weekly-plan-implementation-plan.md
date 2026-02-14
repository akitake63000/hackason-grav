# Weekly Plan 機能の仕様確認

## Context

ユーザーから、weekly-plan画面（`/feature3/weekly-plan`）の以下4つの仕様が正しく実装されているか確認を求められています：

1. チェックリストを押した際に確認画面が出る
2. 「本日の実績を報告」ボタンで提出・保存できる
3. 提出を押してなかったら午前4時の記録を自動的に保存する
4. 保存が完了すると次の日のアクションが生成される

## 🚨 緊急エラー修正が必要

### エラー内容
```
Failed to generate daily actions APIError: No active plan found
```

### 根本原因

1. **`/plan/current` が期限切れプランを自動的に `status="completed"` に変更する**
   - コード: `services/agent-api/app/routers/lifestyle.py` Line 2213
   - プランが期限切れの場合、Firestoreで `status: "active"` → `"completed"` に更新

2. **フロントエンドの不整合**
   - `isPlanExpired()` が期限切れと判定する前に、ユーザーが「ミッションを生成する」ボタンを押せてしまう
   - または、先ほどの修正(`isPlanExpired()`)がまだデプロイされていない

3. **`/plan/daily/generate` の前提条件**
   - Line 2022: `status == "active"` のプランのみ検索
   - 既に `"completed"` になったプランは見つからない → エラー

### 即座の解決策

**方式1: バックエンド修正（推奨・最速）**

`/plan/daily/generate` を修正して、プランIDを受け取り、statusチェックをスキップする：

```python
# services/agent-api/app/routers/lifestyle.py Line 2011-2026

@router.post("/plan/daily/generate", response_model=PlanResponse)
@limiter.limit("10/minute")
def generate_daily(
    request: Request,
    req: GenerateDailyRequest,  # 新規: リクエストボディ追加
    uid: str = Depends(get_current_uid),
) -> PlanResponse:
    """今日のアクションを手動で生成する"""
    db = get_firestore_client()

    # 変更前: status == "active" で検索
    # plans_ref = db.collection("users").document(uid).collection("plans")
    # query = plans_ref.where("status", "==", "active").limit(1)
    # docs = query.get()

    # 変更後: planId で直接取得（statusチェックなし）
    plan_ref = db.collection("users").document(uid).collection("plans").document(req.planId)
    plan_doc = plan_ref.get()

    if not plan_doc.exists:
        raise HTTPException(status_code=404, detail="Plan not found")

    plan_data = plan_doc.to_dict()

    # 期限切れチェック（エラーではなく警告）
    now = datetime.now(ZoneInfo("Asia/Tokyo"))
    end_date = datetime.fromisoformat(plan_data.get("endDate").replace('Z', '+00:00'))
    if now > end_date:
        logging.warning(f"Generating actions for expired plan {req.planId}")

    # ... 以下既存のロジック
```

**新規モデル追加**:
```python
class GenerateDailyRequest(BaseModel):
    planId: str
```

**方式2: フロントエンド修正（暫定対応）**

期限切れプランでは「ミッションを生成する」ボタンを表示しない：

```javascript
// apps/web/src/app/feature3/weekly-plan/page.jsx Line 578-600

{!plan.targetActions || plan.targetActions.length === 0 ? (
    // 期限切れチェックを追加
    isPlanExpired() ? (
        <div className={styles.createButtonContainer}>
            <AlertCircle size={48} color="#f59e0b" style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#313131', marginBottom: '8px' }}>
                プラン期限切れ
            </h3>
            <p style={{ fontSize: '14px', color: '#7f786d', marginBottom: '24px' }}>
                新しいプランを作成してください
            </p>
            <Button onClick={handleCreateNewPlan}>
                次週のプランを作成
            </Button>
        </div>
    ) : (
        // 既存のミッション生成ボタン
        <div className={styles.createButtonContainer}>
            ...
        </div>
    )
) : (
    // 既存のミッション表示
    ...
)}
```

### 推奨実装順序

1. **即座（5分）**: 方式2のフロントエンド修正 → デプロイ → エラー回避
2. **短期（30分）**: 方式1のバックエンド修正 → より柔軟な対応

## 仕様確認結果

### 1. ✅ チェックリストを押した際に確認画面が出る

**実装状況**: ✅ **実装済み**

**コード**:
- `apps/web/src/app/feature3/weekly-plan/page.jsx`
  - Line 121-130: `handleCheckClick()` - チェック時に確認モーダルを表示
  - Line 722-763: `confirmingAction` モーダルUI - 「本当にやった？」確認画面
  - Line 151-204: `handleConfirmCheck()` - 確認後のAPI呼び出し

**動作**:
1. ユーザーがミッションのチェックボックスをクリック
2. 「本当にやった？」モーダルが表示される
3. 「やった！」ボタンで確定、「まだ」ボタンでキャンセル

---

### 2. ✅ 「本日の実績を報告」ボタンで提出・保存できる

**実装状況**: ✅ **実装済み**

**コード**:
- `apps/web/src/app/feature3/weekly-plan/page.jsx`
  - Line 246-281: `handleConfirmDay()` - 確定ボタンのハンドラ
  - Line 696-707: UI - 「本日の達成内容を確定する」ボタン

- `services/agent-api/app/routers/lifestyle.py`
  - Line 2306-2326: `POST /plan/confirm` エンドポイント
  - `isConfirmed: True` フラグをFirestoreに保存

**動作**:
1. ユーザーが「本日の達成内容を確定する」ボタンをクリック
2. APIが `users/{uid}/plans/{planId}/logs/{date}` に `isConfirmed: true` を保存
3. 画面が「本日のミッション完了！」状態に更新される

---

### 3. ❌ 提出を押してなかったら午前4時の記録を自動的に保存する

**実装状況**: ❌ **実装されていない**

**調査結果**:
- フロントエンド: 午前4時の自動保存ロジックは存在しない
- バックエンド:
  - `/plan/confirm` は手動確定のみ対応
  - `/plan/current` は午前4時判定ロジックがあるが（Line 2221-2222）、自動保存はしない
  - スケジューラーやCloud Functionsも確認できない

**現在の動作**:
- ユーザーが確定ボタンを押さない場合、その日のログは `isConfirmed: false` のまま
- 翌日になっても自動で確定されない

**仕様とのギャップ**:
仕様では「午前4時に自動保存」とあるが、実装されていません。

---

### 4. ❌ 保存が完了すると次の日のアクションが生成される

**実装状況**: ❌ **実装されていない**

**調査結果**:
- `/plan/confirm` (Line 2306-2326):
  - `isConfirmed: true` を設定するだけ
  - 次の日のアクション生成は含まれていない

- `/plan/current` (Line 2220-2244):
  - 今日が確定済みなら翌日の日付に進む（`view_date_obj`）
  - 翌日の `dailyActions` を取得するが、**存在しない場合は生成しない**（Line 2240-2243）

- `/plan/daily/generate` (Line 2011-2088):
  - 手動で「ミッションを生成する」ボタンを押す必要がある

**現在の動作**:
1. ユーザーが「確定」ボタンを押す
2. その日のログが `isConfirmed: true` になる
3. 翌日、ユーザーは「ミッションを生成する」ボタンを手動で押す必要がある

**仕様とのギャップ**:
仕様では「保存完了で次の日のアクションが自動生成」とあるが、実装されていません。

---

## まとめ

| 仕様 | 実装状況 | 備考 |
|------|---------|------|
| ① チェック時の確認画面 | ✅ 実装済み | モーダル表示、正常動作 |
| ② 「本日の実績を報告」ボタン | ✅ 実装済み | API連携、正常動作 |
| ③ 午前4時の自動保存 | ❌ 未実装 | スケジューラーなし |
| ④ 次の日のアクション自動生成 | ❌ 未実装 | 手動ボタン押下が必要 |

**結論**: 4つの仕様のうち、**2つは実装済み、2つは未実装**です。

---

## 実装方法の提案（Codex分析結果）

### 方式A: 既存エンドポイント修正のみ（最速）

**概要**: `lifestyle.py` のみを修正して実装

**変更内容**:

1. **`/plan/confirm` に次日アクション自動生成を追加**
   ```python
   # Line 2306-2326 付近に追加
   # 1. 現在のログ確定処理
   log_ref.update({"isConfirmed": True, "updatedAt": ...})

   # 2. 次日のアクション自動生成（追加）
   next_date_obj = datetime.strptime(req.date, "%Y-%m-%d") + timedelta(days=1)
   next_date_str = next_date_obj.strftime("%Y-%m-%d")

   # dailyActions が未作成なら生成
   daily_actions_doc = plan_ref.collection("dailyActions").document(next_date_str).get()
   if not daily_actions_doc.exists:
       # tendencyScores から取得
       scores = {...}  # 既存ロジック流用
       actions = generate_daily_actions(scores, answers)
       plan_ref.collection("dailyActions").document(next_date_str).set({
           "actions": actions,
           "createdAt": now.isoformat()
       })
   ```

2. **`/plan/current` に前日自動確定を追加**
   ```python
   # Line 2220-2244 付近に追加
   # 午前4時以降で、前日が未確定なら自動確定
   if now.hour >= 4:
       yesterday_obj = current_date_obj - timedelta(days=1)
       yesterday_str = yesterday_obj.strftime("%Y-%m-%d")
       yesterday_log_doc = plan_doc.reference.collection("logs").document(yesterday_str).get()
       if yesterday_log_doc.exists:
           yesterday_data = yesterday_log_doc.to_dict()
           if not yesterday_data.get("isConfirmed", False):
               # 自動確定
               yesterday_log_doc.reference.update({"isConfirmed": True, "autoConfirmed": True})
   ```

**メリット**:
- ✅ 最小工数（1ファイルのみ変更）
- ✅ 即日リリース可能
- ✅ インフラ追加不要

**デメリット**:
- ❌ ユーザーがアクセスしない限り午前4時の自動確定が実行されない
- ❌ GETに副作用（`/plan/current`）

**適用シーン**: MVP・最速実装・ユーザー数が少ない段階

---

### 方式B: Cloud Scheduler + Cloud Function（推奨）

**概要**: 毎日午前4時に自動実行するバッチ処理を追加

**構成**:

1. **Cloud Scheduler**
   - スケジュール: `0 4 * * *` (毎日04:00 JST)
   - ターゲット: Cloud Function (HTTP)

2. **Cloud Function** (`services/functions/daily-plan-processor/`)
   ```python
   import firebase_admin
   from firebase_admin import firestore
   from datetime import datetime, timedelta
   from zoneinfo import ZoneInfo

   def process_daily_plans(request):
       """毎日04:00 JSTに実行される"""
       db = firestore.client()
       now = datetime.now(ZoneInfo("Asia/Tokyo"))
       yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")
       today_str = now.strftime("%Y-%m-%d")

       # 1. 全てのactiveプランを取得
       plans = db.collection_group("plans").where("status", "==", "active").stream()

       processed_count = 0
       for plan_doc in plans:
           plan_ref = plan_doc.reference

           # 2. 前日のログを自動確定
           yesterday_log_ref = plan_ref.collection("logs").document(yesterday_str)
           yesterday_log = yesterday_log_ref.get()
           if yesterday_log.exists:
               if not yesterday_log.to_dict().get("isConfirmed", False):
                   yesterday_log_ref.update({"isConfirmed": True, "autoConfirmed": True})
           else:
               # ログが存在しない場合は空で作成
               yesterday_log_ref.set({"completedActions": [], "isConfirmed": True, "autoConfirmed": True})

           # 3. 今日のアクションを生成（未作成の場合のみ）
           today_actions_ref = plan_ref.collection("dailyActions").document(today_str)
           if not today_actions_ref.get().exists:
               # tendencyScores から取得
               uid = plan_ref.parent.parent.id
               tendency_doc = db.collection("users").document(uid).collection("tendencyScores").document("latest").get()
               if tendency_doc.exists:
                   scores = {...}  # データから取得
                   actions = generate_daily_actions(scores, {})
                   today_actions_ref.set({"actions": actions, "createdAt": now.isoformat()})

           processed_count += 1

       return {"status": "success", "processed": processed_count}
   ```

3. **`/plan/confirm` に次日アクション生成を追加**（方式Aと同じ）

**メリット**:
- ✅ 午前4時に確実に実行される（ユーザーアクセス不要）
- ✅ 仕様を完全に満たす
- ✅ `/plan/current` の副作用なし

**デメリット**:
- ❌ インフラ追加（Cloud Scheduler + Cloud Function）
- ❌ 開発・テスト時間が必要
- ❌ 大量ユーザー時の実行時間管理が必要

**適用シーン**: 本番運用・ユーザー数増加後・要件を厳密に満たす必要がある場合

---

### 方式C: Firestore Trigger（参考）

**概要**: `isConfirmed` 変更時にトリガー実行

**デメリット**:
- 午前4時の自動確定には対応できない（別途スケジューラーが必要）

**結論**: 単独では要件を満たせないため非推奨

---

## 推奨実装戦略

### フェーズ1: 方式A（最速実装）

**目的**: 機能を最速でリリースし、ユーザーフィードバックを得る

**実装内容**:
1. `/plan/confirm` に次日アクション自動生成を追加
2. `/plan/current` に前日自動確定を追加（4時以降のアクセス時）

**工数**: 1-2時間

**制限事項**:
- ユーザーが午前4時以降にアクセスするまで自動確定されない
- ユーザーに事前周知が必要

---

### フェーズ2: 方式B（完全実装）

**目的**: 仕様を完全に満たし、ユーザー体験を向上

**実装内容**:
1. Cloud Scheduler + Cloud Function を追加
2. 毎日午前4時に全ユーザーの自動確定＋アクション生成

**工数**: 4-6時間（テスト含む）

**前提条件**:
- フェーズ1の動作確認完了
- Cloud Functionのデプロイ権限

---

## Critical Files

### 方式A（最速実装）

1. **services/agent-api/app/routers/lifestyle.py** (MODIFY)
   - Line 2306-2326: `/plan/confirm` に次日アクション生成を追加
   - Line 2220-2244: `/plan/current` に前日自動確定を追加

### 方式B（完全実装）

1. **services/functions/daily-plan-processor/main.py** (CREATE)
   - Cloud Function の実装

2. **services/functions/daily-plan-processor/requirements.txt** (CREATE)
   - 依存パッケージ

3. **terraform/ or gcloud CLI** (CREATE)
   - Cloud Scheduler の設定

4. **services/agent-api/app/routers/lifestyle.py** (MODIFY)
   - Line 2306-2326: `/plan/confirm` に次日アクション生成を追加

---

## 検証方法

### 方式A

1. **手動確定 → 次日アクション生成**
   ```bash
   # 1. 確定APIを呼ぶ
   curl -X POST "http://localhost:8000/api/v1/lifestyle/plan/confirm" \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"planId": "xxx", "date": "2026-02-13"}'

   # 2. Firestoreで確認
   # dailyActions/2026-02-14 が作成されているか
   ```

2. **前日自動確定**
   ```bash
   # 午前4時以降に /plan/current を呼ぶ
   # 前日のログが isConfirmed: true になっているか確認
   ```

### 方式B

1. **Cloud Function 手動実行**
   ```bash
   gcloud functions call daily-plan-processor --region=asia-northeast1
   ```

2. **Firestore確認**
   - 前日のログが全て `isConfirmed: true`
   - 今日の `dailyActions` が全てのactiveプランに存在

3. **Cloud Scheduler ログ確認**
   ```bash
   gcloud logging read 'resource.type="cloud_scheduler_job"' --limit 10
   ```
