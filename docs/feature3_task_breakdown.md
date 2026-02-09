# 機能3（生活アドバイザー）詳細分担書

**戦略: 縦割り開発（Vertical Slicing）**
2名の開発者が「入力（分析）→ 出力（提案）」の因果関係を一気通貫で担当することで、コンテキストの整合性を保ちつつ、相互依存を排除して並行開発を行います。

---

## 担当A：食の改善フロー（Dietary Flow）

**概要**: 日々の食事画像から栄養状態を分析し、具体的な食材と購入先を提案するフロー。

### 1. 担当範囲（Scope）
*   **入口**: ホーム画面 `> フードスナイパー`（新規追加）
*   **分析**: 食事写真の撮影・アップロード・Gemini Vision栄養解析
*   **提案**: 不足栄養素を補う食材提案 + Googleマップでの店舗検索
*   **API**: `/api/v1/food-sniper/*`

### 2. 開発タスク（Tasks）

#### フロントエンド (Next.js)
*   **[NEW] `apps/web/src/app/feature3/meal/page.tsx`**
    *   食事写真の撮影/アップロードUI
    *   解析中のローディング表示
    *   解析結果（推定カロリー・栄養素）の表示
*   **[NEW] `apps/web/src/app/feature3/food-recommend/page.tsx`**
    *   食材レコメンドリスト表示（例: 「ビタミンC不足 → パプリカ」）
    *   近くの店舗マップ表示（Google Maps Embed or Link）
*   **[New] `apps/web/src/app/feature3/nearby-stores/page.tsx`**
    *   (Optional) 店舗検索詳細画面 ※food-recommend内に統合しても可

#### バックエンド (FastAPI)
*   **[NEW] `services/agent-api/app/routers/food_sniper.py`**
    *   `POST /analyze`: 画像を受け取り、栄養素を構造化データで返す
    *   `POST /recommend`: 栄養データを受け取り、食材リストと店舗情報を返す
*   **[NEW] `services/agent-api/app/agents/lifestyle_agent/tools/analyze_meal_photo.py`**
    *   Gemini Vision プロンプト: 「この料理の栄養素（タンパク質, ビタミン等）を推定して」
*   **[NEW] `services/agent-api/app/agents/lifestyle_agent/tools/recommend_foods.py`**
    *   ロジック実装: 不足栄養素に基づき、推奨食材リストを生成する
*   **[NEW] `services/agent-api/app/agents/lifestyle_agent/tools/search_nearby_stores.py`**
    *   Google Places API 連携: 「近くのスーパーマーケット」検索

### 3. 因果の設計（Causality）
*   「揚げ物ばかり食べた（画像）」→「脂質過多・ミネラル不足（分析）」→「海藻サラダ・キノコを買おう（提案）」
*   このロジック全体を一人で調整する。

---

## 担当B：生活習慣・傾向フロー（Lifestyle Flow）

**概要**: 問診により生活習慣を把握し、4つのメカニズム軸でスコア化、具体的な改善アクションを提案するフロー。

### 1. 担当範囲（Scope）
*   **入口**: ホーム画面 `> ライフスタイル診断`
*   **Input**: 
    *   Profile（性別・年齢）→ 自動取得
    *   機能1結果（頭皮状態）→ 自動取得
    *   **問診** → 本セクションで設計
*   **分析**: 4メカニズム軸でスコア算出
*   **提案**: スコアに基づく具体的改善アクション
*   **API**: `/api/v1/lifestyle/*`

### 2. 4メカニズム軸（分析モデル）

| 軸 | 説明 | 髪への影響 |
| :--- | :--- | :--- |
| **⚖️ ホルモン** | GH(成長ホルモン), メラトニン | 毛包活性化, 髪の成長 |
| **⏰ 体内時計** | Clock遺伝子, 生活リズム | 毛包幹細胞の活性化 |
| **🩸 血流** | 頭皮血流, 血液粘度 | 栄養・酸素供給 |
| **😰 ストレス** | コルチゾール | GAS6タンパク質ブロック→脱毛促進 |

### 3. Action → Mechanism マッピング

| Action | ⚖️ ホルモン | ⏰ 体内時計 | 🩸 血流 | 😰 ストレス |
| :--- | :---: | :---: | :---: | :---: |
| 睡眠(時間) | ◎ | ◎ | ○ | ○ |
| 起床/就寝固定 | ○ | ◎ | - | ○ |
| 朝日を浴びる | ○ | ◎ | - | ○ |
| 有酸素運動 | ○ | ○ | ◎ | ◎ |
| ストレッチ(首/肩) | - | - | ◎ | ○ |
| 入浴(湯船) | - | ○ | ◎ | ◎ |
| ヨガ/瞑想 | - | ○ | ○ | ◎ |
| 禁煙 | ○ | - | ◎ | - |
| 節酒 | ◎ | ○ | ○ | ○ |
| カフェイン制限 | ◎ | ◎ | - | ○ |
| 水分摂取 | - | - | ◎ | - |

### 4. 問診設計（MECE 5択 + 条件分岐）

**基本10問 + 条件付き最大3問**
選択肢は「漏れなくダブりなく（MECE）」の5段階評価（Score 100/80/60/40/20）を基本とする。

| Section | 質問 | Maps To | 詳細 / 変更点 |
| :--- | :--- | :--- | :--- |
| 睡眠 | 就寝時刻 | ホルモン, 体内時計 | 22時前〜2時以降の5段階 |
| 睡眠 | 起床固定 | 体内時計 | 誤差なし〜バラバラの5段階 |
| 睡眠 | 朝日を浴びる | 体内時計 | 毎日〜屋内生活の5段階 |
| 運動 | 有酸素運動頻度 | 血流, ストレス | 毎日20分〜全くしない |
| 血流 | 肩こり/首こり | 血流 | なし〜常に辛い |
| 血流 | 入浴スタイル | 血流, ストレス | 毎日15分〜シャワーのみ |
| ストレス | 目覚めの感覚 | ストレス | スッキリ〜疲労困憊 |
| ストレス | リラックス習慣 | ストレス | 毎日〜時間がない |
| 嗜好品 | 嗜好品チェック(タバコ/酒/カフェイン) | 複合 | 最も頻度が高いものを選択 |
| 水分 | 水分摂取量 | 血流 | 2L以上〜ほとんど飲まない |

**条件分岐**:
1.  **喫煙本数**: 吸わない〜21本以上 (Hormone/Blood Flow ペナルティ)
2.  **飲酒頻度**: 月数回〜毎日多量 (Hormone/Blood Flow ペナルティ)
3.  **カフェイン**: **タイミング重視** (Circadian 調整)
    *   午前中のみ (Score 100) 〜 就寝直前 (Score 20)

### 5. 開発タスク（Tasks）

#### フロントエンド (Next.js)
*   **[DONE] `apps/web/src/app/feature3/tendency/page.tsx`**
    *   問診UI（条件分岐対応, MECE 5択実装済み）
    *   4軸スコアのレーダーチャート表示 (実装済み)
*   **[DONE] `apps/web/src/app/feature3/lifestyle-recommend/page.tsx`**
    *   `exercise-recommend` は廃止し、本ページに統合。
    *   スコアに基づく改善アクション提案
    *   「なぜこのアクションが必要か」の解説表示
*   **[DONE] `apps/web/src/app/feature3/weekly-plan/page.jsx`**
    *   **[NEW]** アコーディオンUI: アクション名をクリックで詳細（Why?）を展開
    *   **[NEW]** ストリーク表示: アクション完了時に即時反映（Optimistic Update）
    *   **[NEW]** デイリー生成: プラン期間中、当日分のアクションをAI生成するボタン

#### バックエンド (FastAPI)
*   **[DONE] `services/agent-api/app/routers/lifestyle.py`**
    *   `POST /tendency`: 問診回答から4軸スコア算出
    *   `GET /recommendation`: スコアに基づく改善アクション取得
    *   `POST /plan/daily/generate`: **[NEW]** 当日分のAIアクション生成（Gemini連携）
*   **[DONE] `services/agent-api/app/agents/lifestyle_agent/tools/analyze_tendency.py`**
    *   ロジック: 問診回答 → 4軸スコア（0-100）
*   **[DONE] `services/agent-api/app/agents/lifestyle_agent/tools/get_hair_analysis.py`**
    *   機能1の結果を取得し、傾向分析の入力とする
*   **[DONE] `services/agent-api/app/agents/lifestyle_agent/tools/recommend_actions.py`**
    *   ロジック: 各軸の低スコア→具体的アクション提案のマッピング
*   **[DONE] `services/agent-api/app/agents/lifestyle_agent/tools/generate_plan.py`**
    *   **[NEW]** Gemini連携: ユーザーの診断結果・過去ログに基づき、ユニークなアクションを生成
    *   **[NEW]** フォールバック: AIエラー時にランダムな固定アクションを提示（ロボット感の低減）

#### 永続化・再診断フロー (Persistence)
*   **[DONE] `services/agent-api/app/routers/lifestyle.py`**
    *   `GET /tendency/latest`: 最新の診断結果・日時を取得
    *   **[DONE]** アンケート回答 (`answers`) も保存し、レコメンド生成に活用
*   **[DONE] `apps/web/src/app/feature3/tendency/page.tsx`**
    *   前回結果の表示・再診断ボタンの実装
*   **[DONE] `apps/web/src/app/feature3/lifestyle-recommend/page.tsx`**
    *   保存されたスコアに基づくレコメンド表示
    *   **[DONE]** 4軸（ホルモン・体内時計・血流・ストレス）ごとのグルーピング表示

### 6. 因果の設計（Causality）
*   「就寝が1時以降（問診）」+「肩こりあり（問診）」→「ホルモン/血流スコア低（分析）」→「0時前に寝よう」「首回しストレッチ」（提案）
*   このロジック全体を一人で調整する。

### 7. 追加改修・品質向上 (Refinements)
*   **[DONE] スコア計算の適正化**
    *   `analyze_tendency.py`: 減点方式によるマイナススコア発生を防ぐため、0〜100点に正規化（クリッピング処理追加）。
*   **[DONE] レコメンドロジックの改善**
    *   `recommend_actions.py`: アンケート回答（喫煙・飲酒など）と連携し、不適切なアクション（非喫煙者への禁煙提案など）をフィルタリング。
    *   `recommend_actions.py`: アクションを「軸ごと」にグルーピングして返却。
*   **[DONE] 行動追跡・PDCAサイクル (Weekly Action Cycle)**
    *   **バックエンド**:
        *   `POST /plan/generate`: 診断結果に基づくAI週間プラン作成（テーマ・3つの重点アクション）
        *   `GET /plan/current`: 進行中プランと当日の実行ログ取得
        *   `POST /plan/check`: アクション実行トグル
    *   **フロントエンド**:
        *   ダッシュボード化: プラン未作成時/進行中/終了時の表示切替
        *   **Reflective Check**: チェック時に「本当に実行したか？」を問うモーダル実装（形骸化防止）
        *   プラン終了時のサイクル（次週プラン作成 or 再診断誘導）実装

---

## 共通・連携事項

*   **ブランチ戦略**:
    *   親ブランチ: `feature/team-c/lifestyle` (ここから切る)
    *   担当A: `feature/team-c/dietary`
    *   担当B: `feature/team-c/tendency`
*   **データ共有**:
    *   お互いのデータは Firestore の `users/{uid}/collection` で分かれているため、競合は基本的に発生しない。
