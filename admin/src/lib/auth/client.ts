import { AUTH_ENDPOINTS } from "@/constants/api";
import { API_BASE_URL } from "@/lib/env";
import { getStoredToken, setStoredToken, clearStoredToken } from "@/lib/auth/session-storage";
import type { Session, SessionUser } from "@/types/auth";

// Better Auth's own `/api/auth/*` routes (see backend/src/index.ts) don't
// follow our `{ success, data }` envelope — they're a separate library with
// their own response shape, so this talks to them directly instead of going
// through lib/api/client.ts.
export class AuthError extends Error {
  /**
   * The HTTP status the sign-in came back with, so the screen can tell
   * "wrong password" apart from "you have tried too often" — Better Auth
   * rate-limits sign-in, and a 429 that reads as "your password is wrong" is
   * how a password somebody has just chosen appears to be broken.
   */
  readonly status: number;

  constructor(status = 0) {
    super("auth_error");
    this.name = "AuthError";
    this.status = status;
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
    throw new AuthError(res.status);
  }

  const body = (await res.json().catch(() => null)) as SignInResponse | null;
  if (!body?.token || !body.user) {
    throw new AuthError(res.status);
  }

  setStoredToken(body.token);
  return { token: body.token, user: body.user };
}

/**
 * Ends the session on the SERVER first, and only then forgets it here.
 *
 * The order matters, and it used to be the other way round: the token was
 * cleared locally and the sign-out request was fired afterwards with its
 * failure swallowed. Offline — on a phone in a shop with bad reception, which
 * is most of them — the screen said "signed out" while the session stayed
 * valid on the server for the full week it lives. On a handset shared between
 * shifts that is a live login nobody can see and nobody can revoke, belonging
 * to somebody who believes they logged out.
 *
 * So the request is awaited, and the caller is told whether it worked. The
 * local token is cleared either way (in `finally`): refusing to clear it
 * would strand somebody on a device they cannot sign out of, which is worse
 * — but "we could not reach the server" is now something the screen can say
 * rather than something nobody finds out.
 */
export async function signOut(): Promise<{ revoked: boolean }> {
  const token = getStoredToken();
  if (!token) return { revoked: true };

  try {
    const res = await fetch(`${API_BASE_URL}${AUTH_ENDPOINTS.SIGN_OUT}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    // A 401 means the server has no such session any more, which is the
    // outcome asked for — it is revoked, not failed.
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
    // The cookie mirror can outlive the localStorage token — iOS hands a
    // freshly installed home-screen app the Safari cookie jar but not its
    // localStorage. Left in place, that cookie makes proxy.ts wave us
    // through to a screen AuthGuard immediately sends back to /login, which
    // proxy sends back here: an install stuck on a spinner forever. Clearing
    // it here keeps the two stores from ever disagreeing.
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
