// Login helper for the three seeded staff accounts (backend/prisma/seed.ts).
// Sessions are cached per role per test file so each suite logs in once.
import { rawRequest } from "./client";

export const SEEDED_ACCOUNTS = {
  ADMIN: { email: "admin@organza.test", password: "password123" },
  MANAGER: { email: "manager@organza.test", password: "password123" },
  EMPLOYEE: { email: "employee@organza.test", password: "password123" },
} as const;

export type SeededRole = keyof typeof SEEDED_ACCOUNTS;

export interface Session {
  token: string;
  userId: string;
  role: string;
  email: string;
}

interface SignInAttempt {
  status: number;
  session?: Session;
}

// Better Auth's /api/auth/* routes are handled directly by its own toNodeHandler
// (see src/index.ts) and are NOT wrapped in the app's { success, data } envelope,
// so this talks to rawRequest rather than apiRequest.
export async function signIn(email: string, password: string): Promise<SignInAttempt> {
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
              "Make sure the target API has been seeded via `npm run seed`."
          );
        }
        return result.session;
      })
    );
  }
  return sessionCache.get(role)!;
}
