# Firestore インデックス デプロイ依頼

## 概要

食材レコメンド機能（Feature 3）にキャッシュ機能を追加しました。
キャッシュの検索クエリに **Firestore 複合インデックス** が必要ですが、
CI/CD パイプラインに Firestore デプロイが含まれていないため、手動デプロイが必要です。

## 対象プロジェクト

- **Firebase プロジェクト**: `hackason-grab`

## 必要な作業

以下のいずれかの方法でインデックスをデプロイしてください。

---

### 方法 A: Firebase CLI（推奨）

リポジトリのルートで以下を実行：

```bash
firebase login
firebase deploy --only firestore:indexes --project hackason-grab
```

必要な権限: **Firebase 管理者** または **プロジェクト編集者** 以上

---

### 方法 B: Firebase コンソールから手動作成

[Firebase コンソール > Firestore > インデックス](https://console.firebase.google.com/project/hackason-grab/firestore/indexes) にアクセスし、以下の2つの複合インデックスを作成してください。

#### インデックス 1: レコメンドキャッシュ用

| 項目 | 値 |
|------|-----|
| コレクション ID | `items` |
| クエリスコープ | コレクション |
| フィールド 1 | `hairPattern` - 昇順 (Ascending) |
| フィールド 2 | `createdAt` - 降順 (Descending) |

#### インデックス 2: レシピキャッシュ用

| 項目 | 値 |
|------|-----|
| コレクション ID | `recipes` |
| クエリスコープ | コレクション |
| フィールド 1 | `foodName` - 昇順 (Ascending) |
| フィールド 2 | `hairPattern` - 昇順 (Ascending) |
| フィールド 3 | `createdAt` - 降順 (Descending) |

---

## なぜ必要か

バックエンド (`food_sniper.py`) で以下のクエリを実行しています：

```python
# レコメンドキャッシュ検索（items インデックス）
db.collection("foodRequests").document(uid)
  .collection("items")
  .where("hairPattern", "==", pattern)
  .order_by("createdAt", direction=DESCENDING)
  .limit(1)

# レシピキャッシュ検索（recipes インデックス）
db.collection("foodRequests").document(uid)
  .collection("recipes")
  .where("foodName", "==", food_name)
  .where("hairPattern", "==", pattern)
  .order_by("createdAt", direction=DESCENDING)
  .limit(1)
```

Firestore で `.where()` + `.order_by()` を組み合わせるクエリには複合インデックスが必須です。
インデックスがないとクエリがエラーになり、毎回 Gemini API を呼ぶフォールバック動作になります（機能は壊れないが、キャッシュが効かない）。

## インデックス未作成時の影響

- 食材レコメンド: 毎回 Gemini API で再生成（キャッシュが効かない）
- レシピ: 毎回 Gemini API で再生成（「他のレシピを見る」と同じ動作）
- エラーにはならない（try/except でフォールバック済み）

## 完了確認

インデックス作成後、ステータスが「有効」になるまで数分かかります。
有効化後、食材レコメンドページを2回アクセスし、2回目がローディングなしで即表示されれば成功です。
