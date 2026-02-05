# エラーハンドリングガイド

## 概要

HairGuard Agentのエラーハンドリング実装ガイドです。

---

## 実装されているエラーハンドリング機能

### 1. 自動リトライ機能

`apiFetch` 関数は自動的にリトライを行います。

**特徴**:
- デフォルトで最大3回リトライ
- 指数バックオフ（1秒、2秒、4秒）
- ネットワークエラーと5xxエラーのみリトライ

**使用例**:

```typescript
import { apiFetch } from "@/lib/api";

// デフォルト設定（3回リトライ）
const response = await apiFetch("/api/v1/photos/analyze", {
  method: "POST",
  body: JSON.stringify(data),
});

// カスタム設定
const response = await apiFetch(
  "/api/v1/photos/analyze",
  {
    method: "POST",
    body: JSON.stringify(data),
  },
  {
    maxRetries: 5,        // 最大5回リトライ
    retryDelay: 2000,     // 初回2秒待機
  }
);
```

---

### 2. エラークラス

複数のエラークラスが定義されています。

| クラス | 説明 | リトライ対象 |
|--------|------|------------|
| `NetworkError` | ネットワークエラー | ✅ |
| `AuthError` | 認証エラー（401） | ❌ |
| `APIError` | APIエラー（4xx/5xx） | 5xxのみ |

**使用例**:

```typescript
import { AuthError, NetworkError, getErrorMessage } from "@/lib/error-handler";

try {
  const response = await apiFetch("/api/v1/data");
  const data = await response.json();
} catch (error) {
  if (error instanceof AuthError) {
    // 認証エラー → ログイン画面へ
    router.push("/login");
  } else if (error instanceof NetworkError) {
    // ネットワークエラー → ユーザーに通知
    alert("インターネット接続を確認してください");
  } else {
    // その他のエラー
    alert(getErrorMessage(error));
  }
}
```

---

### 3. Error Boundary

Reactコンポーネントのエラーをキャッチします。

**使用例**:

```tsx
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function MyPage() {
  return (
    <ErrorBoundary>
      <MyComponent />
    </ErrorBoundary>
  );
}

// カスタムfallbackUI
<ErrorBoundary
  fallback={(error, reset) => (
    <div>
      <h2>エラーが発生しました</h2>
      <p>{error.message}</p>
      <button onClick={reset}>リトライ</button>
    </div>
  )}
>
  <MyComponent />
</ErrorBoundary>
```

---

### 4. エラー表示コンポーネント

統一されたエラー表示UIを提供します。

```tsx
import { ErrorDisplay } from "@/components/ErrorBoundary";

function MyComponent() {
  const [error, setError] = useState(null);

  if (error) {
    return <ErrorDisplay error={error} onRetry={() => setError(null)} />;
  }

  return <div>...</div>;
}
```

---

## エラーハンドリングのベストプラクティス

### ✅ Do

1. **具体的なエラーメッセージを表示**
   ```typescript
   // Good
   throw new Error("画像のアップロードに失敗しました。ファイルサイズが10MBを超えています");

   // Bad
   throw new Error("エラー");
   ```

2. **ユーザーに次のアクションを提示**
   ```tsx
   <ErrorDisplay
     error={error}
     onRetry={handleRetry}  // リトライボタン
   />
   ```

3. **エラーをログに記録**
   ```typescript
   try {
     // ...
   } catch (error) {
     console.error("Failed to upload image:", error);
     // エラーハンドリング
   }
   ```

### ❌ Don't

1. **エラーを無視しない**
   ```typescript
   // Bad
   try {
     await riskyOperation();
   } catch {
     // 何もしない
   }
   ```

2. **技術的すぎるメッセージを表示しない**
   ```typescript
   // Bad
   alert("TypeError: Cannot read property 'data' of undefined");

   // Good
   alert("データの取得に失敗しました。再度お試しください");
   ```

3. **すべてのエラーを同じように扱わない**
   ```typescript
   // Bad
   catch (error) {
     alert("エラーが発生しました");
   }

   // Good
   catch (error) {
     if (error instanceof AuthError) {
       router.push("/login");
     } else if (error instanceof NetworkError) {
       alert("インターネット接続を確認してください");
     } else {
       alert(getErrorMessage(error));
     }
   }
   ```

---

## トラブルシューティング

### リトライが無限ループする

リトライ可能なエラーを適切に判定してください。

```typescript
// リトライ可能かチェック
if (isRetryableError(error)) {
  // リトライ
} else {
  // すぐにthrow
  throw error;
}
```

### エラーメッセージが表示されない

Error Boundaryを使用しているか確認してください。

```tsx
// layout.tsx または page.tsx
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

### 認証エラー時にリダイレクトされない

`AuthError`をキャッチして適切にハンドリングしてください。

```typescript
import { AuthError } from "@/lib/error-handler";

try {
  // API call
} catch (error) {
  if (error instanceof AuthError) {
    router.push("/login");
  }
}
```

---

## 参考資料

- [apps/web/src/lib/error-handler.ts](/home/yujmatsu/projects/hackason-grab/apps/web/src/lib/error-handler.ts)
- [apps/web/src/lib/api.ts](/home/yujmatsu/projects/hackason-grab/apps/web/src/lib/api.ts)
- [apps/web/src/components/ErrorBoundary.tsx](/home/yujmatsu/projects/hackason-grab/apps/web/src/components/ErrorBoundary.tsx)
