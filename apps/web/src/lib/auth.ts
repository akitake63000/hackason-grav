export const MOCK_AUTH_KEY = "hairguard:mock-auth";

export function setMockAuthed(isAuthed: boolean): void {
  if (typeof window === "undefined") return;
  if (isAuthed) {
    window.localStorage.setItem(MOCK_AUTH_KEY, "1");
  } else {
    window.localStorage.removeItem(MOCK_AUTH_KEY);
  }
}

export function isMockAuthed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MOCK_AUTH_KEY) === "1";
}
