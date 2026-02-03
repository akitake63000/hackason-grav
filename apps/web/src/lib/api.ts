import { getIdToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export const apiFetch = async (
  input: string,
  init: RequestInit = {},
): Promise<Response> => {
  const token = await getIdToken();
  const headers = new Headers(init.headers ?? {});
  if (token) {
    headers.set("X-Firebase-Auth", token);
  }
  const url = input.startsWith("http") ? input : `${API_BASE}${input}`;
  return fetch(url, { ...init, headers });
};
