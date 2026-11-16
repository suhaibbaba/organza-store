import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_TOKEN_KEY } from "@/constants/storage";

// The bearer token lives in both localStorage (read by the API client) and a
// plain cookie (read by proxy.ts, which can't reach localStorage) — see
// proxy.ts for why this is an optimistic check only.
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_TOKEN_KEY, token);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_TOKEN_KEY}=${token}; path=/; max-age=${SESSION_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_TOKEN_KEY);
  document.cookie = `${SESSION_TOKEN_KEY}=; path=/; max-age=0`;
}
