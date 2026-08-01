import type { SEEDED_ACCOUNTS } from "@tests/constants";

export type SeededRole = keyof typeof SEEDED_ACCOUNTS;

export interface Session {
  token: string;
  userId: string;
  role: string;
  email: string;
}

export interface SignInAttempt {
  status: number;
  session?: Session;
}
