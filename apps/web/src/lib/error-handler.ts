/**
 * エラーハンドリングユーティリティ
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NetworkError extends AppError {
  constructor(message: string = "ネットワークエラーが発生しました") {
    super(message, "NETWORK_ERROR");
    this.name = "NetworkError";
  }
}

export class AuthError extends AppError {
  constructor(message: string = "認証エラーが発生しました") {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthError";
  }
}

export class APIError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    code?: string,
  ) {
    super(message, code, statusCode);
    this.name = "APIError";
  }
}

/**
 * エラーからユーザーフレンドリーなメッセージを取得
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    // ネットワークエラー判定
    if (isNetworkError(error)) {
      return "インターネット接続を確認してください";
    }
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "予期しないエラーが発生しました";
}

/**
 * ネットワークエラーかどうかを判定
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof NetworkError) {
    return true;
  }

  if (error instanceof TypeError) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("failed to fetch")
    );
  }

  return false;
}

/**
 * リトライ可能なエラーかどうかを判定
 */
export function isRetryableError(error: unknown): boolean {
  // ネットワークエラーはリトライ可能
  if (isNetworkError(error)) {
    return true;
  }

  // APIErrorの場合、5xx系エラーのみリトライ
  if (error instanceof APIError) {
    return error.statusCode !== undefined && error.statusCode >= 500;
  }

  return false;
}

/**
 * HTTPレスポンスからエラーを生成
 */
export async function createErrorFromResponse(
  response: Response,
): Promise<AppError> {
  const statusCode = response.status;

  // レスポンスボディを取得（エラー詳細がある場合）
  let errorDetail = "";
  try {
    const data = await response.json();
    errorDetail = data.detail || data.message || "";
  } catch {
    // JSONパース失敗時は無視
  }

  // ステータスコード別のエラーメッセージ
  switch (statusCode) {
    case 400:
      return new APIError(
        errorDetail || "リクエストが正しくありません",
        statusCode,
        "BAD_REQUEST",
      );
    case 401:
      return new AuthError(errorDetail || "認証が必要です");
    case 403:
      return new APIError(
        errorDetail || "アクセス権限がありません",
        statusCode,
        "FORBIDDEN",
      );
    case 404:
      return new APIError(
        errorDetail || "リソースが見つかりません",
        statusCode,
        "NOT_FOUND",
      );
    case 429:
      return new APIError(
        errorDetail || "リクエストが多すぎます。しばらくしてから再試行してください",
        statusCode,
        "TOO_MANY_REQUESTS",
      );
    case 500:
    case 502:
    case 503:
    case 504:
      return new APIError(
        errorDetail || "サーバーエラーが発生しました。しばらくしてから再試行してください",
        statusCode,
        "SERVER_ERROR",
      );
    default:
      return new APIError(
        errorDetail || `エラーが発生しました (${statusCode})`,
        statusCode,
      );
  }
}
