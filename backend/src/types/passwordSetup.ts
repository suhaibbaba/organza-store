import type { PasswordTokenPurpose } from "@store/shared/constants/passwordSetup";

export type { PasswordTokenPurpose };

/** A stored token, as the service sees it. Never carries the token itself. */
export interface StoredPasswordToken {
  id: string;
  userId: string;
  tokenHash: string;
  purpose: PasswordTokenPurpose;
  expiresAt: Date;
  usedAt: Date | null;
}

/** The token service's dependencies, so its rules are testable without a database (real one: lib/passwordTokenStore.ts). */
export interface PasswordTokenStore {
  create(input: {
    userId: string;
    tokenHash: string;
    purpose: PasswordTokenPurpose;
    expiresAt: Date;
  }): Promise<StoredPasswordToken>;
  findByHash(tokenHash: string): Promise<StoredPasswordToken | null>;
  /** Marks a token used only if still unused, returning false otherwise — the single-use guarantee. */
  markUsed(id: string, usedAt: Date): Promise<boolean>;
  /** Drops every outstanding (unused) token for a user. */
  revokeAllForUser(userId: string): Promise<number>;
}

/** What issuing a token hands back. The raw token exists only here and in the email. */
export interface IssuedPasswordToken {
  token: string;
  expiresAt: Date;
  purpose: PasswordTokenPurpose;
}

export interface PasswordTokenService {
  issue(userId: string, purpose: PasswordTokenPurpose): Promise<IssuedPasswordToken>;
  /** Redeems a token: validates and marks it used, atomically. */
  redeem(token: string): Promise<StoredPasswordToken | null>;
  /** Reads a token without consuming it — for the "is this link still good?" check. */
  inspect(token: string): Promise<StoredPasswordToken | null>;
  revokeAllForUser(userId: string): Promise<number>;
}

export interface PasswordTokenServiceOptions {
  store: PasswordTokenStore;
  /** Injectable clock, so expiry is testable without waiting three days. */
  now?: () => Date;
  /** Injectable randomness, so a test can assert what was hashed. */
  generateToken?: () => string;
}
