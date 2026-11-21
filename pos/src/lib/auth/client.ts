import { AUTH_ENDPOINTS } from "@/constants/api";
import { API_BASE_URL } from "@/lib/env";
import { getStoredToken, setStoredToken, clearStoredToken } from "@/lib/auth/session-storage";
import type { Session, SessionUser } from "@/types/auth";

// Better Auth's /api/auth/* routes don't use our envelope, so this talks to them directly.
export class AuthError extends Error {
  // So a 429 (rate-limited) isn't shown as "wrong password".
  readonly status: number;

  // A 403 here is a deactivated account, which needs a different message than a wrong password.
  readonly code?: string;

  constructor(status = 0, code?: string) {
    super("auth_error");
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

interface SignInResponse {
  token: string;
  user: SessionUser;
}

export async function signInWithEmail(email: string, password: string): Promise<Session> {
  const res = await fetch(`${API_BASE_URL}${AUTH_ENDPOINTS.SIGN_IN_EMAIL}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const failure = (await res.json().catch(() => null)) as { code?: string } | null;
    throw new AuthError(res.status, failure?.code);
  }

  const body = (await res.json().catch(() => null)) as SignInResponse | null;
  if (!body?.token || !body.user) {
    throw new AuthError(res.status);
  }

  setStoredToken(body.token);
  return { token: body.token, user: body.user };
}

// Server first, then locally: clearing the token first left a live session behind whenever the request failed.
export async function signOut(): Promise<{ revoked: boolean }> {
  const token = getStoredToken();
  if (!token) {
    return { revoked: true };
  }

  try {
    const res = await fetch(`${API_BASE_URL}${AUTH_ENDPOINTS.SIGN_OUT}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    // A 401 means the session is already gone, which is the outcome asked for.
    return { revoked: res.ok || res.status === 401 };
  } catch {
    return { revoked: false };
  } finally {
    clearStoredToken();
  }
}

export async function fetchSession(): Promise<SessionUser | null> {
  const token = getStoredToken();
  if (!token) {
    // iOS gives a new home-screen app Safari's cookies but not its localStorage, so the cookie must go too.
    clearStoredToken();
    return null;
  }

  const res = await fetch(`${API_BASE_URL}${AUTH_ENDPOINTS.GET_SESSION}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    credentials: "include",
  });

  if (!res.ok) {
    clearStoredToken();
    return null;
  }

  const body = (await res.json().catch(() => null)) as { user: SessionUser } | null;
  if (!body?.user) {
    clearStoredToken();
    return null;
  }

  return body.user;
}
