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

### 4. 問診設計（条件分岐型）

**基本10問 + 条件付き最大3問**

| Section | 質問 | Maps To |
| :--- | :--- | :--- |
| 睡眠 | 就寝時刻 | ホルモン, 体内時計 |
| 睡眠 | 起床固定 | 体内時計 |
| 睡眠 | 朝日を浴びる | 体内時計 |
| 運動 | 有酸素運動頻度 | 血流, ストレス |
| 血流 | 肩こり/首こり | 血流 |
| 血流 | 入浴スタイル | 血流, ストレス |
| ストレス | 目覚めの感覚 | ストレス |
| ストレス | リラックス習慣 | ストレス |
| 嗜好品 | 嗜好品チェック(タバコ/酒/カフェイン) | 複合 |
| 水分 | 水分摂取量 | 血流 |

**条件分岐**: 嗜好品で選択されたものだけ詳細質問へ

### 5. 開発タスク（Tasks）

#### フロントエンド (Next.js)
*   **[NEW] `apps/web/src/app/feature3/tendency/page.tsx`**
    *   問診UI（条件分岐対応）
    *   4軸スコアのレーダーチャート表示
*   **[NEW] `apps/web/src/app/feature3/exercise-recommend/page.tsx`**
    *   スコアに基づく改善アクション提案
    *   「なぜこのアクションが必要か」の解説表示

#### バックエンド (FastAPI)
*   **[NEW] `services/agent-api/app/routers/lifestyle.py`**
    *   `POST /tendency`: 問診回答から4軸スコア算出
    *   `GET /recommendation`: スコアに基づく改善アクション取得
*   **[NEW] `services/agent-api/app/agents/lifestyle_agent/tools/analyze_tendency.py`**
    *   ロジック: 問診回答 → 4軸スコア（0-100）
*   **[NEW] `services/agent-api/app/agents/lifestyle_agent/tools/get_hair_analysis.py`**
    *   機能1の結果を取得し、傾向分析の入力とする
*   **[NEW] `services/agent-api/app/agents/lifestyle_agent/tools/recommend_actions.py`**
    *   ロジック: 各軸の低スコア→具体的アクション提案のマッピング

### 6. 因果の設計（Causality）
*   「就寝が1時以降（問診）」+「肩こりあり（問診）」→「ホルモン/血流スコア低（分析）」→「0時前に寝よう」「首回しストレッチ」（提案）
*   このロジック全体を一人で調整する。

---

## 共通・連携事項

*   **ブランチ戦略**:
    *   親ブランチ: `feature/team-c/lifestyle` (ここから切る)
    *   担当A: `feature/team-c/dietary`
    *   担当B: `feature/team-c/tendency`
*   **データ共有**:
    *   お互いのデータは Firestore の `users/{uid}/collection` で分かれているため、競合は基本的に発生しない。
