# 機能1 → 機能3 連携 開発指示書

> **対象**: 機能1（AI頭皮チェック）担当者
> **目的**: AI診断結果の薄毛タイプを機能3（食材レコメンド）に受け渡す
> **機能3側の準備**: 完了済み（受け取る側は実装済み）

---

## やること（1つだけ）

**AI診断の結果画面から、食材レコメンドページへ遷移するときに `hairPattern` をURLパラメータで渡す。**

### 遷移先URL

```
/feature3/food-recommend?hairPattern=M字
```

---

## 使えるキー一覧（完全一致で判定）

| キー | 表示名 | 対象 |
|------|--------|------|
| `M字` | M字型薄毛 | 男性 |
| `O字` | O字型薄毛 | 男性 |
| `U字` | U字型薄毛 | 男性 |
| `びまん性` | びまん性薄毛 | 女性 |
| `オルセン型` | オルセン型薄毛 | 女性 |
| `ハミルトン型` | ハミルトン型薄毛 | 女性 |

**注意**: 上記6つ以外の文字列を渡すと、汎用的なおすすめ食材が表示されます（パターン別の精度は下がる）。

---

## 実装例

### パターンA: Next.js の router.push を使う場合

```jsx
import { useRouter } from 'next/navigation'

const router = useRouter()

// AI診断結果が出た後に呼ぶ
const goToFoodRecommend = (hairPattern) => {
  router.push(`/feature3/food-recommend?hairPattern=${encodeURIComponent(hairPattern)}`)
}

// 使い方
goToFoodRecommend('M字')
```

### パターンB: Link コンポーネントを使う場合

```jsx
import Link from 'next/link'

<Link href={`/feature3/food-recommend?hairPattern=${encodeURIComponent(diagnosisResult)}`}>
  食事アドバイスを見る
</Link>
```

### パターンC: ボタンの onClick で遷移する場合

```jsx
<Button onClick={() => {
  window.location.href = `/feature3/food-recommend?hairPattern=${encodeURIComponent(hairPattern)}`
}}>
  おすすめ食材を見る
</Button>
```

---

## 機能3側で何が起きるか

```
hairPattern=M字 を受け取る
    ↓
バックエンドAPI に hairPattern を送信
    ↓
M字パターン専用の食材データが返る
（原因: DHT → 対策: 5α-リダクターゼ抑制 → 食材: 納豆、牡蠣、緑茶...）
    ↓
パターン情報カード + 栄養素別食材カード + レシピボタン が表示される
```

### hairPattern がない場合

- 「まず薄毛タイプ診断を行いましょう」というメッセージ + 機能1への誘導ボタンが表示される
- 一般的なおすすめ食材は表示される（パターン別ではない）

---

## 動作確認方法

ブラウザで直接URLを叩いて確認できます：

```
https://{デプロイ先URL}/feature3/food-recommend?hairPattern=M字
https://{デプロイ先URL}/feature3/food-recommend?hairPattern=O字
https://{デプロイ先URL}/feature3/food-recommend?hairPattern=びまん性
```

パターンごとに異なる食材カードが表示されれば成功です。

---

## FAQ

**Q: 診断結果が6タイプに分類できない場合は？**
A: `hairPattern` を渡さずに遷移してOKです。一般的な食材が表示されます。

**Q: 複数のパターンが該当する場合は？**
A: 最も可能性の高い1つを選んで渡してください。

**Q: sessionStorage でも渡せる？**
A: URLパラメータ推奨です。sessionStorageだとページリロードで消える可能性があります。
