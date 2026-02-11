# チャット機能 - 応答時間計測スクリプト

## 概要

FLASHモードとPROモードでチャットの応答時間を計測します。

## 実行方法

### 1. Firebase ID トークンの取得（認証用）

ブラウザで以下を実行してトークンを取得：

```javascript
// ブラウザのコンソールで実行
firebase.auth().currentUser.getIdToken().then(token => {
  console.log(token);
  copy(token); // クリップボードにコピー
});
```

### 2. 環境変数の設定

```bash
export FIREBASE_ID_TOKEN="取得したトークン"
```

### 3. スクリプトの実行

```bash
cd /home/yujmatsu/projects/hackason-grab/work
python3 measure_chat_performance.py
```

または：

```bash
# トークンを直接指定
FIREBASE_ID_TOKEN="トークン" python3 measure_chat_performance.py
```

## 出力内容

- **途中経過**: タスクステータス（queued → running → succeeded）
- **処理時間**: 開始から完了までの時間
- **タスクデータ**: レスポンス全体のJSON
- **比較結果**: FLASHとPROの処理時間の差分と倍率

## 環境変数

| 変数名 | デフォルト値 | 説明 |
|--------|-------------|------|
| `FIREBASE_ID_TOKEN` | - | Firebase認証トークン（必須） |
| `API_BASE_URL` | `https://agent-api-7wsihnjf7q-an.a.run.app` | APIのベースURL |

## テスト内容

- **メッセージ**: 「薄毛が気になる」
- **FLASHモード**: `detail="flash"` (gemini-2.5-flash)
- **PROモード**: `detail="pro"` (gemini-2.5-pro)

## 注意事項

- 本番環境のAPIを使用するため、Firebase認証が必要です
- 1リクエストごとに約2秒の間隔でポーリングします
- 最大10分でタイムアウトします
- Gitにはコミットしないでください（一時的な検証用）
