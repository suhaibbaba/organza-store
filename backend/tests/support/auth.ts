// Sessions for the demo staff, cached once per run (isolate:false + singleFork make the cache process-wide).
import { rawRequest } from "@tests/support/client";
import { AUTH_RATE_LIMIT_BASE_DELAY_MS, AUTH_RATE_LIMIT_MAX_ATTEMPTS, SEEDED_ACCOUNTS } from "@tests/constants";
import type { Session, SeededRole, SignInAttempt } from "@tests/types";

export { SEEDED_ACCOUNTS };
export type { SeededRole, Session };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Better Auth's routes are not wrapped in the app envelope, so this uses rawRequest.
async function signInOnce(email: string, password: string): Promise<SignInAttempt> {
  const { status, body } = await rawRequest("/api/auth/sign-in/email", {
    method: "POST",
    body: { email, password },
  });
  if (status !== 200 || typeof body?.token !== "string") {
    return { status };
  }
  return {
    status,
    session: { token: body.token, userId: body.user.id, role: body.user.role, email: body.user.email },
  };
}

// Retries a 429: sessions are cached, but a shared sandbox can still be rate-limited by other traffic.
export async function signIn(email: string, password: string): Promise<SignInAttempt> {
  let lastAttempt: SignInAttempt = { status: 0 };
  for (let attempt = 0; attempt < AUTH_RATE_LIMIT_MAX_ATTEMPTS; attempt++) {
    lastAttempt = await signInOnce(email, password);
    if (lastAttempt.status !== 429) {
      return lastAttempt;
    }
    if (attempt < AUTH_RATE_LIMIT_MAX_ATTEMPTS - 1) {
      await sleep(AUTH_RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  return lastAttempt;
}

const sessionCache = new Map<SeededRole, Promise<Session>>();

export function getSession(role: SeededRole): Promise<Session> {
  if (!sessionCache.has(role)) {
    const { email, password } = SEEDED_ACCOUNTS[role];
    sessionCache.set(
      role,
      signIn(email, password).then((result) => {
        if (!result.session) {
          throw new Error(
            `Seeded ${role} login failed (HTTP ${result.status}). ` +
              "Make sure the target API has been demo-seeded via `npm run seed:demo` (see backend/README.md).",
          );
        }
        return result.session;
      }),
    );
  }
  return sessionCache.get(role)!;
}
