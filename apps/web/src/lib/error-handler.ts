/**
 * Centralized error handling utilities.
 * Provides consistent error handling and user-friendly error messages.
 */

/**
 * Standardized error codes matching backend API responses.
 */
export enum ErrorCode {
  // Authentication errors (401)
  AUTH_TOKEN_MISSING = "AUTH_TOKEN_MISSING",
  AUTH_TOKEN_INVALID = "AUTH_TOKEN_INVALID",
  AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED",
  AUTH_ERROR = "AUTH_ERROR",

  // Authorization errors (403)
  PERMISSION_DENIED = "PERMISSION_DENIED",
  RESOURCE_ACCESS_DENIED = "RESOURCE_ACCESS_DENIED",
  FORBIDDEN = "FORBIDDEN",

  // Not found errors (404)
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  PHOTO_NOT_FOUND = "PHOTO_NOT_FOUND",
  NOT_FOUND = "NOT_FOUND",

  // Validation errors (400, 422)
  INVALID_INPUT = "INVALID_INPUT",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  BAD_REQUEST = "BAD_REQUEST",

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",

  // Server errors (500)
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_API_ERROR = "EXTERNAL_API_ERROR",
  SERVER_ERROR = "SERVER_ERROR",

  // Service unavailable (503)
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  EXTERNAL_SERVICE_TIMEOUT = "EXTERNAL_SERVICE_TIMEOUT",

  // Client-side errors
  NETWORK_ERROR = "NETWORK_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * Structured error response from API.
 */
export interface APIErrorResponse {
  error: {
    code: string;
    message: string;
    status: number;
    details?: Record<string, any>;
    request_id?: string;
  };
}

/**
 * Application error class with structured information.
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: Record<string, any>;
  public readonly requestId?: string;

  constructor(
    message: string,
    code?: string,
    statusCode?: number,
    details?: Record<string, any>,
    requestId?: string
  ) {
    super(message);
    this.name = "AppError";
    this.code = code || ErrorCode.UNKNOWN_ERROR;
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Get user-friendly error message.
   */
  public getUserFriendlyMessage(): string {
    return getUserFriendlyErrorMessage(this.code as ErrorCode, this.message);
  }

  /**
   * Check if error is retryable.
   */
  public isRetryable(): boolean {
    return isRetryableError(this);
  }
}

/**
 * Network error class.
 */
export class NetworkError extends AppError {
  constructor(message: string = "ネットワークエラーが発生しました") {
    super(message, ErrorCode.NETWORK_ERROR);
    this.name = "NetworkError";
  }
}

/**
 * Authentication error class.
 */
export class AuthError extends AppError {
  constructor(message: string = "認証エラーが発生しました") {
    super(message, ErrorCode.AUTH_ERROR, 401);
    this.name = "AuthError";
  }
}

/**
 * API error class.
 */
export class APIError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    code?: string,
    details?: Record<string, any>
  ) {
    super(message, code, statusCode, details);
    this.name = "APIError";
  }
}

/**
 * Get user-friendly error message based on error code.
 */
export function getUserFriendlyErrorMessage(
  code: ErrorCode | string,
  fallbackMessage?: string
): string {
  const messages: Record<string, string> = {
    // Authentication errors
    [ErrorCode.AUTH_TOKEN_MISSING]:
      "認証情報が見つかりません。再度ログインしてください。",
    [ErrorCode.AUTH_TOKEN_INVALID]:
      "認証情報が無効です。再度ログインしてください。",
    [ErrorCode.AUTH_TOKEN_EXPIRED]:
      "セッションの有効期限が切れました。再度ログインしてください。",
    [ErrorCode.AUTH_ERROR]: "認証エラーが発生しました",

    // Authorization errors
    [ErrorCode.PERMISSION_DENIED]:
      "この操作を実行する権限がありません。",
    [ErrorCode.RESOURCE_ACCESS_DENIED]:
      "このリソースへのアクセスが拒否されました。",
    [ErrorCode.FORBIDDEN]: "アクセス権限がありません",

    // Not found errors
    [ErrorCode.RESOURCE_NOT_FOUND]:
      "指定されたリソースが見つかりませんでした。",
    [ErrorCode.USER_NOT_FOUND]:
      "ユーザーが見つかりませんでした。",
    [ErrorCode.PHOTO_NOT_FOUND]:
      "写真が見つかりませんでした。",
    [ErrorCode.NOT_FOUND]: "リソースが見つかりません",

    // Validation errors
    [ErrorCode.INVALID_INPUT]:
      "入力内容に誤りがあります。入力内容を確認してください。",
    [ErrorCode.VALIDATION_FAILED]:
      "入力内容に誤りがあります。入力内容を確認してください。",
    [ErrorCode.BAD_REQUEST]: "リクエストが正しくありません",

    // Rate limiting
    [ErrorCode.RATE_LIMIT_EXCEEDED]:
      "リクエストの制限回数を超えました。しばらく待ってから再度お試しください。",
    [ErrorCode.TOO_MANY_REQUESTS]:
      "リクエストが多すぎます。しばらくしてから再試行してください",

    // Server errors
    [ErrorCode.INTERNAL_ERROR]:
      "サーバーエラーが発生しました。しばらく待ってから再度お試しください。",
    [ErrorCode.DATABASE_ERROR]:
      "データベースエラーが発生しました。しばらく待ってから再度お試しください。",
    [ErrorCode.EXTERNAL_API_ERROR]:
      "外部サービスとの通信中にエラーが発生しました。",
    [ErrorCode.SERVER_ERROR]:
      "サーバーエラーが発生しました。しばらくしてから再試行してください",

    // Service unavailable
    [ErrorCode.SERVICE_UNAVAILABLE]:
      "サービスが一時的に利用できません。しばらく待ってから再度お試しください。",
    [ErrorCode.EXTERNAL_SERVICE_TIMEOUT]:
      "外部サービスへの接続がタイムアウトしました。",

    // Client-side errors
    [ErrorCode.NETWORK_ERROR]:
      "インターネット接続を確認してください",
    [ErrorCode.UNKNOWN_ERROR]:
      "予期しないエラーが発生しました。しばらく待ってから再度お試しください。",
  };

  return messages[code] || fallbackMessage || messages[ErrorCode.UNKNOWN_ERROR];
}

/**
 * Get error message from unknown error type.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.getUserFriendlyMessage();
  }

  if (error instanceof Error) {
    if (isNetworkError(error)) {
      return getUserFriendlyErrorMessage(ErrorCode.NETWORK_ERROR);
    }
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return getUserFriendlyErrorMessage(ErrorCode.UNKNOWN_ERROR);
}

/**
 * Check if error is network error.
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
 * Check if error is retryable.
 */
export function isRetryableError(error: unknown): boolean {
  if (isNetworkError(error)) {
    return true;
  }

  if (error instanceof AppError) {
    const retryableCodes = [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.RATE_LIMIT_EXCEEDED,
      ErrorCode.TOO_MANY_REQUESTS,
      ErrorCode.SERVICE_UNAVAILABLE,
      ErrorCode.EXTERNAL_SERVICE_TIMEOUT,
      ErrorCode.INTERNAL_ERROR,
      ErrorCode.SERVER_ERROR,
    ];
    return retryableCodes.includes(error.code as ErrorCode);
  }

  if (error instanceof APIError) {
    return error.statusCode !== undefined && error.statusCode >= 500;
  }

  return false;
}

/**
 * Check if error requires re-authentication.
 */
export function requiresReauth(error: unknown): boolean {
  if (!(error instanceof AppError)) {
    return false;
  }

  const reauthCodes = [
    ErrorCode.AUTH_TOKEN_MISSING,
    ErrorCode.AUTH_TOKEN_INVALID,
    ErrorCode.AUTH_TOKEN_EXPIRED,
  ];

  return reauthCodes.includes(error.code as ErrorCode);
}

/**
 * Parse error from response or exception.
 */
export async function parseError(error: unknown): Promise<AppError> {
  if (isNetworkError(error)) {
    return new NetworkError();
  }

  if (error instanceof Response) {
    try {
      const errorData: APIErrorResponse = await error.json();
      return new AppError(
        errorData.error.message,
        errorData.error.code,
        errorData.error.status,
        errorData.error.details,
        errorData.error.request_id
      );
    } catch {
      return new APIError(
        `HTTPエラー: ${error.status} ${error.statusText}`,
        error.status,
        ErrorCode.UNKNOWN_ERROR
      );
    }
  }

  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, ErrorCode.UNKNOWN_ERROR, 500);
  }

  return new AppError(
    "予期しないエラーが発生しました",
    ErrorCode.UNKNOWN_ERROR,
    500
  );
}

/**
 * Create error from HTTP response (backward compatibility).
 */
export async function createErrorFromResponse(
  response: Response,
): Promise<AppError> {
  const statusCode = response.status;

  let errorDetail = "";
  let errorCode: string | undefined;

  try {
    const data = await response.json();
    if (data.error) {
      // New structured error format
      errorDetail = data.error.message || "";
      errorCode = data.error.code;
    } else {
      // Legacy format
      errorDetail = data.detail || data.message || "";
    }
  } catch {
    // JSON parse failed
  }

  switch (statusCode) {
    case 400:
      return new APIError(
        errorDetail || "リクエストが正しくありません",
        statusCode,
        errorCode || ErrorCode.BAD_REQUEST,
      );
    case 401:
      return new AuthError(errorDetail || "認証が必要です");
    case 403:
      return new APIError(
        errorDetail || "アクセス権限がありません",
        statusCode,
        errorCode || ErrorCode.FORBIDDEN,
      );
    case 404:
      return new APIError(
        errorDetail || "リソースが見つかりません",
        statusCode,
        errorCode || ErrorCode.NOT_FOUND,
      );
    case 429:
      return new APIError(
        errorDetail || "リクエストが多すぎます。しばらくしてから再試行してください",
        statusCode,
        errorCode || ErrorCode.TOO_MANY_REQUESTS,
      );
    case 500:
    case 502:
    case 503:
    case 504:
      return new APIError(
        errorDetail || "サーバーエラーが発生しました。しばらくしてから再試行してください",
        statusCode,
        errorCode || ErrorCode.SERVER_ERROR,
      );
    default:
      return new APIError(
        errorDetail || `エラーが発生しました (${statusCode})`,
        statusCode,
        errorCode || ErrorCode.UNKNOWN_ERROR
      );
  }
}

/**
 * Log error with structured information.
 */
export function logError(error: AppError, context?: Record<string, any>): void {
  const errorInfo = {
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    requestId: error.requestId,
    details: error.details,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  };

  if (process.env.NODE_ENV === "development") {
    console.error("[AppError]", errorInfo);
  }

  // TODO: Integrate with error monitoring service (e.g., Sentry)
}

/**
 * Retry function with exponential backoff.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: AppError | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = await parseError(error);

      if (!lastError.isRetryable()) {
        throw lastError;
      }

      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
