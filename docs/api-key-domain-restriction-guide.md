# Firebase API Key ドメイン制限設定ガイド

最終更新: 2026-02-05

---

## 目的

Firebase API Key を特定のドメインからのみ使用可能にし、不正利用を防止する。

---

## 設定対象

| API キー | 用途 | 設定場所 |
|---------|------|---------|
| Web API Key | ブラウザからのFirebase呼び出し | Google Cloud Console |
| OAuth Client ID | Google Sign-In | Google Cloud Console |

---

## 手順 A: Firebase Web API Key の制限

### 1. Google Cloud Console にアクセス

```
https://console.cloud.google.com/apis/credentials?project=hackason-grab
```

### 2. API キーを選択

- 「認証情報」タブ
- 該当のAPI Keyをクリック（「Browser key (auto created by Firebase)」など）

### 3. アプリケーションの制限を設定

**「HTTPリファラー（ウェブサイト）」を選択**

**許可するドメインを追加**:
```
https://hackason-grab.web.app/*
https://hackason-grab.firebaseapp.com/*
https://*.web.app/*          # プレビュー環境用（オプション）
http://localhost:3000/*      # 開発環境
http://localhost:3001/*      # 開発環境（予備ポート）
http://127.0.0.1:3000/*      # 開発環境（IPv4）
```

### 4. API の制限（推奨）

**「API を制限」を選択**

**許可するAPIを選択**:
- ✅ Identity Toolkit API
- ✅ Token Service API
- ✅ Cloud Firestore API
- ✅ Cloud Storage for Firebase API
- ✅ Firebase Installations API
- ✅ Cloud Run API （APIバックエンド用）

### 5. 保存

「保存」ボタンをクリック

---

## 手順 B: OAuth Client ID の制限

### 1. Google Cloud Console にアクセス

```
https://console.cloud.google.com/apis/credentials?project=hackason-grab
```

### 2. OAuth 2.0 クライアント ID を選択

- 「Web client (auto created by Google Service)」などの名前をクリック

### 3. 承認済みの JavaScript 生成元

以下を追加:
```
https://hackason-grab.web.app
https://hackason-grab.firebaseapp.com
http://localhost:3000
http://localhost:3001
```

**注意**: ワイルドカード不可、末尾のスラッシュ不要

### 4. 承認済みのリダイレクト URI

以下を追加:
```
https://hackason-grab.web.app/__/auth/handler
https://hackason-grab.firebaseapp.com/__/auth/handler
http://localhost:3000/__/auth/handler
http://localhost:3001/__/auth/handler
```

### 5. 保存

「保存」ボタンをクリック

---

## 設定の効果

### セキュリティ効果

| 効果 | 説明 | 重要度 |
|------|------|--------|
| 不正利用の防止 | 他のドメインからAPI Keyを使われることを防止 | ⭐⭐⭐ |
| 請求額の保護 | 第三者による不正利用での課金を防止 | ⭐⭐⭐ |
| 攻撃対象の縮小 | API Keyの流出時の影響を限定 | ⭐⭐ |

### 動作例

**設定前**:
```
❌ 誰かがあなたのAPI Keyをコピー
❌ 自分のサイト（evil.com）でそのAPI Keyを使用
❌ あなたのFirebaseプロジェクトにアクセス可能
❌ あなたの請求額が増加
```

**設定後**:
```
✅ 誰かがあなたのAPI Keyをコピー
✅ 自分のサイト（evil.com）でそのAPI Keyを使用
❌ エラー: "API key not valid. Please pass a valid API key."
✅ あなたのプロジェクトは保護される
```

---

## 注意点

### 1. 設定反映時間

- 通常：**数分以内**
- 最大：**10分程度**

### 2. 開発環境の追加

開発時に使用するすべてのポートを追加：
```
http://localhost:3000/*
http://localhost:3001/*   # ポート変更時
http://127.0.0.1:3000/*   # IPv4ループバック
```

### 3. プレビュー環境

Firebase Hosting のプレビューURL用にワイルドカードを使用：
```
https://*.web.app/*
https://*.firebaseapp.com/*
```

### 4. エラー発生時の対処

設定後にエラーが出た場合：
1. ブラウザのキャッシュをクリア
2. 5-10分待つ
3. 設定したドメインが正しいか確認
4. HTTPとHTTPS、www有無を確認

---

## 設定後の確認方法

### 1. 許可されたドメインでの確認

1. https://hackason-grab.web.app にアクセス
2. Google Sign-In を実行
3. **正常にログインできればOK**

### 2. 許可されていないドメインでの確認（テスト）

1. 開発ツールのコンソールを開く
2. 以下のコマンドを実行:

```javascript
// API Keyを使用してFirebase APIを呼び出し
fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=YOUR_API_KEY', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ returnSecureToken: true })
});
```

3. **エラーが返ればOK**:
```json
{
  "error": {
    "code": 400,
    "message": "API key not valid. Please pass a valid API key.",
    "errors": [...]
  }
}
```

---

## トラブルシューティング

### 問題: ログインできない

**原因候補**:
1. 設定したドメインが間違っている
2. 設定が反映されていない（5-10分待つ）
3. キャッシュが残っている

**対処**:
1. Google Cloud Console で設定を再確認
2. ブラウザのキャッシュをクリア
3. シークレットモードで試す
4. 10分待ってから再試行

### 問題: 開発環境で動かない

**原因候補**:
1. localhost のポート番号が違う
2. HTTP/HTTPS の違い

**対処**:
1. 実際に使用しているポート番号を確認
2. `http://localhost:XXXX/*` を追加
3. `http://127.0.0.1:XXXX/*` も追加

---

## セキュリティのベストプラクティス

### 実装済み ✅

| 項目 | 状態 |
|------|------|
| Firestore Rules | ✅ 認証+オーナー検証 |
| Storage Rules | ✅ 認証+画像制限 |
| Cloud Run認証 | ✅ 認証ミドルウェア |

### 推奨追加設定 🔲

| 項目 | 状態 |
|------|------|
| API Key ドメイン制限 | 🔲 未設定（本ガイドで実施） |
| OAuth Client ID 制限 | 🔲 未設定（本ガイドで実施） |

---

## 参考資料

- [Firebase API Key Best Practices](https://firebase.google.com/docs/projects/api-keys)
- [Google Cloud API Key Restrictions](https://cloud.google.com/docs/authentication/api-keys#api_key_restrictions)
- [OAuth 2.0 Redirect URI Validation](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation)

---

## チェックリスト

設定完了後、以下を確認：

- [ ] Google Cloud Console でAPI Key制限を設定
- [ ] HTTPリファラー制限を追加（本番+開発環境）
- [ ] API制限を追加（推奨APIのみ許可）
- [ ] OAuth Client ID の JavaScript生成元を設定
- [ ] OAuth Client ID のリダイレクトURIを設定
- [ ] 設定保存後、5-10分待機
- [ ] 本番環境でログインテスト
- [ ] 開発環境（localhost）でログインテスト
- [ ] ブラウザキャッシュをクリア
- [ ] シークレットモードでテスト

---

## 設定完了日

- **設定日**: ____年____月____日
- **設定者**: ____________________
- **確認日**: ____年____月____日
- **確認者**: ____________________
