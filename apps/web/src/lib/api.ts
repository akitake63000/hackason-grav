import { getIdToken } from "./auth";
import {
  createErrorFromResponse,
  isRetryableError,
  NetworkError,
} from "./error-handler";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

/**
 * 指数バックオフでスリープ
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * リトライ機能付きAPIフェッチ
 */
export const apiFetch = async (
  input: string,
  init: RequestInit = {},
  options: { maxRetries?: number; retryDelay?: number } = {},
): Promise<Response> => {
  const { maxRetries = 3, retryDelay = 1000 } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const token = await getIdToken();
      const headers = new Headers(init.headers ?? {});
      if (token) {
        headers.set("X-Firebase-Auth", token);
      }
      const url = input.startsWith("http") ? input : `${API_BASE}${input}`;
      const response = await fetch(url, { ...init, headers });

      // レスポンスがエラーの場合
      if (!response.ok) {
        const error = await createErrorFromResponse(response);

        // リトライ可能なエラーでない場合は即座にthrow
        if (!isRetryableError(error)) {
          throw error;
        }

        // 最後の試行の場合はthrow
        if (attempt === maxRetries - 1) {
          throw error;
        }

        // リトライ待機
        lastError = error;
        const delay = retryDelay * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;

      // ネットワークエラーの場合
      if (error instanceof TypeError && error.message.includes("fetch")) {
        const networkError = new NetworkError();

        // 最後の試行でない場合はリトライ
        if (attempt < maxRetries - 1) {
          const delay = retryDelay * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }

        throw networkError;
      }

      // リトライ可能なエラーでない場合は即座にthrow
      if (!isRetryableError(error)) {
        throw error;
      }

      // 最後の試行の場合はthrow
      if (attempt === maxRetries - 1) {
        throw error;
      }

      // リトライ待機
      const delay = retryDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  // すべてのリトライが失敗した場合
  throw lastError;
};
