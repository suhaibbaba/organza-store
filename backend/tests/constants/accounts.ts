// The demo staff every suite signs in as; the demo seed never runs on deploy (rule 11), so a target is seeded by hand.
export const SEEDED_PASSWORD = "password123";

export const SEEDED_ACCOUNTS = {
  ADMIN: { email: "admin@store.test", password: SEEDED_PASSWORD },
  MANAGER: { email: "manager@store.test", password: SEEDED_PASSWORD },
  EMPLOYEE: { email: "employee@store.test", password: SEEDED_PASSWORD },
} as const;
