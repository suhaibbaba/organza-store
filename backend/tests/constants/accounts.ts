// The three seeded staff accounts (backend/prisma/seed.ts) every suite logs
// in with, plus the shared password those accounts (and any staff user a
// test creates) use.
export const SEEDED_PASSWORD = "password123";

export const SEEDED_ACCOUNTS = {
  ADMIN: { email: "admin@organza.test", password: SEEDED_PASSWORD },
  MANAGER: { email: "manager@organza.test", password: SEEDED_PASSWORD },
  EMPLOYEE: { email: "employee@organza.test", password: SEEDED_PASSWORD },
} as const;
