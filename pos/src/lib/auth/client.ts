import { AUTH_ENDPOINTS } from "@/constants/api";
import { API_BASE_URL } from "@/lib/env";
import { getStoredToken, setStoredToken, clearStoredToken } from "@/lib/auth/session-storage";
import type { Session, SessionUser } from "@/types/auth";

// Better Auth's own `/api/auth/*` routes (see backend/src/index.ts) don't
// follow our `{ success, data }` envelope — they're a separate library with
// their own response shape, so this talks to them directly instead of going
// through lib/api/client.ts.
export class AuthError extends Error {
  constructor() {
    super("auth_error");
    this.name = "AuthError";
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
    throw new AuthError();
  }

  const body = (await res.json().catch(() => null)) as SignInResponse | null;
  if (!body?.token || !body.user) {
    throw new AuthError();
  }

  setStoredToken(body.token);
  return { token: body.token, user: body.user };
}

export async function signOut(): Promise<void> {
  const token = getStoredToken();
  clearStoredToken();
  if (!token) return;

  await fetch(`${API_BASE_URL}${AUTH_ENDPOINTS.SIGN_OUT}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  }).catch(() => undefined);
}

export async function fetchSession(): Promise<SessionUser | null> {
  const token = getStoredToken();
  if (!token) return null;

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
