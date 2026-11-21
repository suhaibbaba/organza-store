import { AUTH_ENDPOINTS } from "@/constants/api";
import { API_BASE_URL } from "@/lib/env";
import { getStoredToken, setStoredToken, clearStoredToken } from "@/lib/auth/session-storage";
import type { Session, SessionUser } from "@/types/auth";

// Better Auth's routes don't use our envelope, so this talks to them directly.
export class AuthError extends Error {
  // So a 429 from rate limiting doesn't read as "wrong password".
  readonly status: number;

  // A 403 here is a deactivated account, not a wrong password.
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

// Revokes on the server first and reports whether it worked; the local token is cleared either way.
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
    // A 401 means the session is already gone: revoked, not failed.
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
    // iOS gives a new home-screen install Safari's cookies but not localStorage; a stale cookie mirror loops on /login.
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
