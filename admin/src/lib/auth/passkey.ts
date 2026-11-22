import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import {
  ACCOUNT_INACTIVE_AUTH_CODE,
  PASSKEY_NOT_FOUND_AUTH_CODE,
  SESSION_NOT_FRESH_AUTH_CODE,
} from "@store/shared/constants/auth";
import { AUTH_ENDPOINTS, HTTP_TOO_MANY_REQUESTS } from "@/constants/api";
import { API_BASE_URL } from "@/lib/env";
import { fetchSession } from "@/lib/auth/client";
import { getStoredToken, setStoredToken } from "@/lib/auth/session-storage";
import type { PasskeyFailure, Session } from "@/types/auth";

export class PasskeyError extends Error {
  readonly failure: PasskeyFailure;

  constructor(failure: PasskeyFailure) {
    super("passkey_error");
    this.name = "PasskeyError";
    this.failure = failure;
  }
}

export function passkeysSupported(): boolean {
  return browserSupportsWebAuthn();
}

// The device's own prompt: closing it, or a key already on this account, are said apart from a real failure.
function promptFailure(error: unknown): PasskeyError {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "AbortError") {
    return new PasskeyError("cancelled");
  }
  if (name === "InvalidStateError") {
    return new PasskeyError("alreadyAdded");
  }
  return new PasskeyError("failed");
}

async function serverFailure(res: Response): Promise<PasskeyError> {
  if (res.status === HTTP_TOO_MANY_REQUESTS) {
    return new PasskeyError("rateLimited");
  }
  const code = ((await res.json().catch(() => null)) as { code?: string } | null)?.code;
  if (code === ACCOUNT_INACTIVE_AUTH_CODE) {
    return new PasskeyError("deactivated");
  }
  if (code === SESSION_NOT_FRESH_AUTH_CODE) {
    return new PasskeyError("signInAgain");
  }
  if (code === PASSKEY_NOT_FOUND_AUTH_CODE) {
    return new PasskeyError("notOnAccount");
  }
  return new PasskeyError("failed");
}

// The challenge travels in Better Auth's cookie, so every call carries credentials.
async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new PasskeyError("failed");
  }
}

export async function signInWithPasskey(): Promise<Session> {
  const optionsRes = await authFetch(AUTH_ENDPOINTS.PASSKEY_SIGN_IN_OPTIONS);
  if (!optionsRes.ok) {
    throw await serverFailure(optionsRes);
  }
  let response;
  try {
    response = await startAuthentication({ optionsJSON: await optionsRes.json() });
  } catch (error) {
    throw promptFailure(error);
  }

  const verifyRes = await authFetch(AUTH_ENDPOINTS.PASSKEY_SIGN_IN, {
    method: "POST",
    body: JSON.stringify({ response }),
  });
  if (!verifyRes.ok) {
    throw await serverFailure(verifyRes);
  }
  const token = ((await verifyRes.json().catch(() => null)) as { session?: { token?: string } } | null)?.session?.token;
  if (!token) {
    throw new PasskeyError("failed");
  }
  setStoredToken(token);
  // The user comes from get-session, the same filtered shape a password sign-in sees.
  const user = await fetchSession();
  if (!user) {
    throw new PasskeyError("failed");
  }
  return { token, user };
}

export async function registerPasskey(): Promise<void> {
  const optionsRes = await authFetch(AUTH_ENDPOINTS.PASSKEY_REGISTER_OPTIONS);
  if (!optionsRes.ok) {
    throw await serverFailure(optionsRes);
  }
  let response;
  try {
    response = await startRegistration({ optionsJSON: await optionsRes.json() });
  } catch (error) {
    throw promptFailure(error);
  }

  const verifyRes = await authFetch(AUTH_ENDPOINTS.PASSKEY_REGISTER, {
    method: "POST",
    body: JSON.stringify({ response }),
  });
  if (!verifyRes.ok) {
    throw await serverFailure(verifyRes);
  }
}
