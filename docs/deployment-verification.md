# デプロイ検証レポート

**プロジェクト**: HairGuard Agent (hackason-grab)
**検証日**: YYYY-MM-DD
**検証者**: [Your Name]

---

## 検証環境

| 項目 | 値 |
|------|-----|
| Firebase Project ID | hackason-grab |
| Cloud Run Service | agent-api |
| Region | asia-northeast1 |
| Firebase Hosting URL | https://hackason-grab.web.app |

---

## 検証結果

### ✅ 1. Firebase Hosting デプロイ状況

**実行コマンド**:
```bash
firebase hosting:sites:list --project hackason-grab
```

**結果**:
- [ ] ✅ 成功
- [ ] ❌ 失敗

**詳細**:
```
[ここにコマンド実行結果を貼り付け]
```

---

### ✅ 2. Cloud Run デプロイ状況

**実行コマンド**:
```bash
gcloud run services describe agent-api --region=asia-northeast1 --project=hackason-grab
```

**結果**:
- [ ] ✅ 成功
- [ ] ❌ 失敗

**Cloud Run URL**:
```
https://[service-name]-[hash]-an.a.run.app
```

---

### ✅ 3. Health Endpoint 疎通確認

**実行コマンド**:
```bash
curl -v [CLOUD_RUN_URL]/api/health
```

**結果**:
- [ ] ✅ HTTP 200 OK
- [ ] ❌ エラー

**レスポンス**:
```json
{
  "status": "ok"
}
```

---

### ✅ 4. Firebase Hosting URL 確認

**実行コマンド**:
```bash
curl -v https://hackason-grab.web.app
```

**結果**:
- [ ] ✅ HTTP 200 OK
- [ ] ❌ エラー

**確認事項**:
- [ ] ログイン画面が表示される
- [ ] 画面レイアウトが正常
- [ ] エラーがない

---

### ✅ 5. Hosting → Cloud Run Rewrite 確認

**実行コマンド**:
```bash
curl -v https://hackason-grab.web.app/api/health
```

**結果**:
- [ ] ✅ HTTP 200 OK（Rewrite動作中）
- [ ] ❌ エラー

**確認事項**:
- [ ] `/api/*` が Cloud Run にルーティングされている
- [ ] レスポンスが正常

---

## 発見された問題

### 問題1: [問題タイトル]

**内容**:
[問題の詳細]

**影響範囲**:
- [ ] クリティカル
- [ ] 高
- [ ] 中
- [ ] 低

**修正提案**:
[修正方法の提案]

---

## 総合評価

- [ ] ✅ すべての検証項目が正常
- [ ] ⚠️ 一部問題あり（運用可能）
- [ ] ❌ 重大な問題あり（修正必要）

---

## 次のアクション

1. [アクション1]
2. [アクション2]
3. [アクション3]

---

## 参考情報

- [チーム分担書](/home/yujmatsu/projects/hackason-grab/docs/チーム分担書.md)
- [機能一覧書](/home/yujmatsu/projects/hackason-grab/docs/機能一覧書.md)
- [システム仕様書](/home/yujmatsu/projects/hackason-grab/docs/system_spec.md)
