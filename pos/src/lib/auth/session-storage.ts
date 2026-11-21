import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_TOKEN_KEY } from "@/constants/storage";

// Mirrored to a cookie because proxy.ts can't read localStorage; that check is optimistic only.
export function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(SESSION_TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SESSION_TOKEN_KEY, token);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_TOKEN_KEY}=${token}; path=/; max-age=${SESSION_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(SESSION_TOKEN_KEY);
  document.cookie = `${SESSION_TOKEN_KEY}=; path=/; max-age=0`;
}
