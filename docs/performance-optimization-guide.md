# パフォーマンス最適化ガイド

## 概要

HairGuard Agentのパフォーマンス最適化施策をまとめたガイドです。

---

## 実装済み最適化

### 1. Next.js ビルド最適化 ✅

**ファイル**: [apps/web/next.config.ts](/home/yujmatsu/projects/hackason-grab/apps/web/next.config.ts)

**最適化内容**:

| 設定項目 | 効果 |
|---------|------|
| `compress: true` | gzip圧縮でファイルサイズ削減 |
| `productionBrowserSourceMaps: false` | ビルドサイズ削減（本番） |
| `swcMinify: true` | SWC minifierで高速ビルド |
| `optimizePackageImports` | Firebaseパッケージの最適化 |

**期待効果**:
- 初回ロード時間: -20〜30%
- ビルドサイズ: -15〜25%

---

### 2. Storage画像最適化 ✅

**ファイル**: [storage.rules](/home/yujmatsu/projects/hackason-grab/storage.rules)

**最適化内容**:

```javascript
// 画像サイズ制限: 10MB以下
function isValidImageSize() {
  return request.resource.size < 10 * 1024 * 1024;
}

// 画像タイプ制限: image/*のみ
function isValidImageType() {
  return request.resource.contentType.matches('image/.*');
}
```

**効果**:
- アップロード時間短縮
- Storage容量削減
- 不正ファイルの排除

---

### 3. Firestoreクエリ最適化 ✅

**ファイル**: [firestore.indexes.json](/home/yujmatsu/projects/hackason-grab/firestore.indexes.json)

**最適化内容**:

| コレクション | インデックスフィールド | 順序 |
|-------------|---------------------|------|
| `analysisResults` | `analyzedAt` | DESC |
| `photos` | `capturedAt` | DESC |
| `reports` | `createdAt` | DESC |
| `messages` | `timestamp` | ASC |

**効果**:
- クエリ応答時間: -50〜70%
- 複合クエリの高速化

**デプロイ方法**:
```bash
firebase deploy --only firestore:indexes --project hackason-grab
```

---

## 追加推奨施策

### 🟡 Cloud Run最適化（本番環境）

**最小インスタンス設定**:
```bash
gcloud run services update agent-api \
  --min-instances=1 \
  --region=asia-northeast1 \
  --project=hackason-grab
```

**効果**:
- コールドスタート削減
- 初回API呼び出し時間: -2〜3秒

**注意**: コスト増加（最小インスタンス1台分の課金）

---

### 🟡 Python依存関係の最適化

**ファイル**: `services/agent-api/requirements.txt`

**推奨**:
- 不要なパッケージの削除
- `pip install --no-cache-dir`でビルド高速化

---

### 🟡 CDN活用

**Firebase Hosting**は自動的にCDNを使用しますが、以下を確認:
- Cache-Controlヘッダーの設定
- 静的ファイルの最大化

---

## パフォーマンス計測

### フロントエンド

**Lighthouse スコア目標**:

| 項目 | 目標スコア |
|------|-----------|
| Performance | 90以上 |
| Accessibility | 90以上 |
| Best Practices | 90以上 |
| SEO | 80以上 |

**計測方法**:
```bash
# Chrome DevTools → Lighthouse
# または
npm install -g lighthouse
lighthouse https://hackason-grab.web.app
```

---

### バックエンド

**API レスポンスタイム目標**:

| エンドポイント | 目標 |
|---------------|------|
| `/api/health` | < 100ms |
| `/api/v1/photos/analyze` | < 5秒 |
| `/api/v1/mental-shield/chat` | < 3秒 |
| `/api/v1/lifestyle/tip` | < 500ms |

**計測方法**:
```bash
# curlで計測
time curl https://hackason-grab.web.app/api/health
```

---

## トラブルシューティング

### ビルドが遅い

**原因**: 依存関係が多い、キャッシュが効いていない

**解決策**:
```bash
# Next.jsキャッシュをクリア
rm -rf apps/web/.next
npm --prefix apps/web run build
```

---

### Firestoreクエリが遅い

**原因**: インデックスが不足している

**解決策**:
1. Firebase Consoleでエラーログを確認
2. 必要なインデックスを`firestore.indexes.json`に追加
3. `firebase deploy --only firestore:indexes`

---

### Cloud Runがコールドスタート

**原因**: 最小インスタンスが0

**解決策**:
```bash
# 最小インスタンスを1に設定
gcloud run services update agent-api --min-instances=1
```

**注意**: コスト増加

---

## ベストプラクティス

### ✅ Do

1. **画像を圧縮してアップロード**
   - 10MB以下
   - JPEG/PNG形式

2. **Firestoreクエリを最小化**
   ```typescript
   // Good: 必要なフィールドのみ取得
   .select('name', 'email')

   // Bad: すべてのフィールドを取得
   .get()
   ```

3. **API呼び出しをキャッシュ**
   ```typescript
   // SWRやReact Queryを活用
   const { data } = useSWR('/api/data', fetcher);
   ```

### ❌ Don't

1. **不要なデータを取得しない**
   ```typescript
   // Bad: 全件取得
   .limit(1000)

   // Good: 必要な件数のみ
   .limit(10)
   ```

2. **ループ内でAPIを呼ばない**
   ```typescript
   // Bad
   for (const id of ids) {
     await fetchData(id);
   }

   // Good: バッチ処理
   await Promise.all(ids.map(id => fetchData(id)));
   ```

---

## 参考資料

- [Next.js Performance Optimization](https://nextjs.org/docs/advanced-features/measuring-performance)
- [Firebase Performance Monitoring](https://firebase.google.com/docs/perf-mon)
- [Cloud Run Performance Best Practices](https://cloud.google.com/run/docs/tips/general)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
