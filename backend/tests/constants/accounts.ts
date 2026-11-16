// The three demo staff accounts (backend/prisma/dev/demo-seed.ts) every suite
// logs in with, plus the shared password those accounts (and any staff user a
// test creates) use.
//
// The demo seed is quarantined and never runs on a deploy (CLAUDE.md rule 11),
// so a sandbox this suite is pointed at has to have been seeded by hand once —
// which is exactly what the sign-in failure message says.
export const SEEDED_PASSWORD = "password123";

export const SEEDED_ACCOUNTS = {
  ADMIN: { email: "admin@organza.test", password: SEEDED_PASSWORD },
  MANAGER: { email: "manager@organza.test", password: SEEDED_PASSWORD },
  EMPLOYEE: { email: "employee@organza.test", password: SEEDED_PASSWORD },
} as const;
