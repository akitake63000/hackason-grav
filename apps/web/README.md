# HairGuard Agent - Frontend

HairGuard Agent のフロントエンドアプリケーション。
Next.js 16 (App Router) + React 19 + Firebase で構築されたSPA。

---

## 技術スタック

- **Next.js** 16.1.6 (App Router, Static Export)
- **React** 19.2
- **Firebase** 12.8 (Auth/Firestore/Storage)
- **TypeScript** 5
- **Framer Motion** 11.15 (アニメーション)
- **Lucide React** 0.468 (アイコン)

---

## ディレクトリ構造

```
apps/web/
├── src/
│   ├── app/              # App Router画面
│   │   ├── feature1/     # 機能1: 生え際・髪密度 AIチェック
│   │   ├── feature2/     # 機能2: 髪のお悩み相談チャットボット
│   │   ├── feature3/     # 機能3: 育毛サポート生活アドバイザー
│   │   ├── home/         # ホーム画面
│   │   ├── login/        # ログイン画面
│   │   ├── onboarding/   # オンボーディング
│   │   ├── profile/      # プロフィール
│   │   ├── settings/     # 設定
│   │   └── ...           # その他（help, privacy, terms等）
│   ├── components/       # 共通コンポーネント
│   └── lib/              # ライブラリ（Firebase初期化等）
├── public/               # 静的ファイル
├── .env.local            # 環境変数（gitignore）
├── .env.example          # 環境変数テンプレート
├── next.config.ts        # Next.js設定
├── package.json          # 依存関係
└── README.md             # 本ドキュメント
```

---

## セットアップ

### 前提条件

- **Node.js** 20+ ([https://nodejs.org/](https://nodejs.org/))
- **Firebase プロジェクト** ([https://console.firebase.google.com/](https://console.firebase.google.com/))

### 手順

#### 1. 依存関係インストール

```bash
npm install
```

#### 2. 環境変数設定

`.env.example` をコピーして `.env.local` を作成：

```bash
cp .env.example .env.local
```

`.env.local` を編集し、Firebase設定を記入：

```env
# Firebase Web SDK設定（Firebase Console → プロジェクト設定 → Web SDKから取得）
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# APIベースURL
NEXT_PUBLIC_API_BASE=http://localhost:8000  # ローカル開発時
# NEXT_PUBLIC_API_BASE=https://hackason-grab.web.app/api  # 本番環境
```

**環境変数の説明**:

| 環境変数 | 説明 | 取得元 |
|---------|------|--------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API Key（公開可能） | Firebase Console → プロジェクト設定 → Web SDK |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase認証ドメイン | 同上 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | FirebaseプロジェクトID | 同上 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Cloud Storageバケット | 同上 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging送信者ID | 同上 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase App ID | 同上 |
| `NEXT_PUBLIC_API_BASE` | APIベースURL | ローカル: `http://localhost:8000`<br>本番: `https://hackason-grab.web.app/api` |

**注意**: `NEXT_PUBLIC_` プレフィックスがついた環境変数はクライアントサイドで使用され、ビルド時にバンドルに含まれます。

---

## 開発

### 開発サーバー起動

```bash
npm run dev
```

→ ブラウザで [http://localhost:3000](http://localhost:3000) を開く

**自動リロード**: ファイル保存時に自動でブラウザがリロードされます。

---

## ビルド

### 本番ビルド

```bash
npm run build
```

ビルド成果物は `out/` ディレクトリに生成されます（Static Export）。

### ビルド検証

ローカルで本番ビルドを検証：

```bash
npm run build
npx serve out
```

→ ブラウザで [http://localhost:3000](http://localhost:3000) を開く

---

## デプロイ

### Firebase Hostingへのデプロイ

ルートディレクトリで実行：

```bash
firebase deploy --only hosting
```

**自動デプロイ**: GitHub Actionsで `main` ブランチへのpush時に自動デプロイされます（`.github/workflows/firebase-hosting-merge.yml`）。

---

## 開発時の注意点

### Next.js 16 App Router

- **ファイルベースルーティング**: `app/` ディレクトリ配下のフォルダ構造がURLパスに対応
- **page.tsx**: 各ルートのページコンポーネント
- **layout.tsx**: 共通レイアウト
- **Server Components vs Client Components**:
  - デフォルトはServer Components（Static Export時は事前レンダリング）
  - `"use client"` を明記するとClient Components

### Static Export（`output: "export"`）

このプロジェクトは **Static Export** を使用しています。以下の制約があります：

**使用できない機能**:
- ❌ Server Actions
- ❌ API Routes (`app/api/*`)
- ❌ Dynamic Routes with `getServerSideProps`
- ❌ Image Optimization（`next/image` はUnoptimizedモード）
- ❌ Internationalization (i18n)
- ❌ Rewrites/Redirects（`next.config.ts`での定義。Firebase Hostingの`firebase.json`で対応）

**代替手段**:
- API呼び出し → Cloud Runへ直接リクエスト（`NEXT_PUBLIC_API_BASE`）
- 画像最適化 → 手動で最適化された画像を配置
- リダイレクト → `firebase.json` で設定

### Firebase SDK

- **クライアントサイドのみ**: Firebase SDKはクライアントサイドで使用
- **初期化**: `src/lib/firebase.ts` で初期化
- **認証状態**: `firebase.auth().onAuthStateChanged()` で監視
- **Firestore**: `firebase.firestore()` でアクセス
- **Storage**: `firebase.storage()` でアクセス

### 環境変数

- **公開**: `NEXT_PUBLIC_*` プレフィックスの変数はビルド時にバンドルに含まれ、ブラウザから参照可能
- **セキュリティ**: 機密情報（シークレットキー等）は `NEXT_PUBLIC_` 変数に含めない
  - Firebase API Key は公開されても問題ない（Firestore Rules, Storage Rulesで保護）

---

## トラブルシューティング

### `npm run dev` でポートが競合する

**症状**: `Error: listen EADDRINUSE: address already in use :::3000`

**解決策**:
```bash
# ポートを変更して起動
npm run dev -- -p 3001
```

### Firebase初期化エラー

**症状**: `Firebase: No Firebase App '[DEFAULT]' has been created`

**解決策**:
1. `.env.local` がルートディレクトリではなく `apps/web/` に存在することを確認
2. 環境変数の値が正しいか確認（Firebase Consoleから再取得）
3. 開発サーバーを再起動

### ビルドエラー: `Error: Image Optimization using the default loader is not compatible with export.`

**症状**: `next/image` を使用すると Static Export でエラー

**解決策**:
- `next.config.ts` で `unoptimized: true` を設定済み
- もし発生した場合、`<Image>` コンポーネントに `unoptimized` propを追加

### 本番環境でAPIが404エラー

**症状**: フロントエンドからAPIを呼び出すと404エラー

**解決策**:
1. `NEXT_PUBLIC_API_BASE` が正しいか確認
   - 本番: `https://hackason-grab.web.app/api`（末尾に `/` なし）
2. `firebase.json` の `rewrites` 設定を確認
3. Cloud Runサービスが起動しているか確認: `gcloud run services list --project hackason-grab`

---

## コード規約

- **ESLint**: `npm run lint` でチェック
- **TypeScript**: 型エラーは `npm run build` でチェック
- **コンポーネント命名**: PascalCase（例: `UserProfile.tsx`）
- **ファイル命名**: kebab-case（例: `user-profile.tsx`）

---

## 関連ドキュメント

- **[ルートREADME.md](../../README.md)** - プロジェクト全体のセットアップ
- **[API仕様書](../../docs/API.md)** - APIエンドポイントの詳細
- **[システム仕様書](../../docs/system_spec.md)** - システム全体の設計
- **[Next.js公式ドキュメント](https://nextjs.org/docs)** - Next.js 16の詳細
- **[Firebase Web SDKドキュメント](https://firebase.google.com/docs/web/setup)** - Firebase SDKの使い方

---

## ライセンス

MIT License
