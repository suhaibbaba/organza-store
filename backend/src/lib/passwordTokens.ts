import crypto from "node:crypto";
import {
  PASSWORD_TOKEN_BYTES,
  PASSWORD_TOKEN_TTL_HOURS,
  type PasswordTokenPurpose,
} from "@organza/shared/constants/passwordSetup";
import type {
  IssuedPasswordToken,
  PasswordTokenService,
  PasswordTokenServiceOptions,
  StoredPasswordToken,
} from "@/types/passwordSetup";

// The rules behind an emailed password link, with no database and no mailer
// anywhere in sight — the store is injected (see types/passwordSetup.ts), so
// "single-use", "expires", and "we never keep the token itself" are properties
// that can be proven rather than hoped for. lib/passwordTokenStore.ts wires
// the Prisma implementation in; tests/unit wires an in-memory one.

/** 32 random bytes, base64url — nothing derived from the user, nothing guessable. */
export function generateToken(): string {
  return crypto.randomBytes(PASSWORD_TOKEN_BYTES).toString("base64url");
}

/**
 * What the database holds. SHA-256 is right here where bcrypt/argon would not
 * be: the input is 256 bits of uniform randomness with no rainbow table
 * behind it, and the lookup has to be a single indexed read.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Constant-time compare, so a hash is never leaked a byte at a time. */
export function tokenHashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function expiryFor(purpose: PasswordTokenPurpose, from: Date): Date {
  return new Date(from.getTime() + PASSWORD_TOKEN_TTL_HOURS[purpose] * 60 * 60 * 1000);
}

/** A token is usable only while unredeemed AND unexpired. Both, every time. */
export function isTokenUsable(token: StoredPasswordToken, now: Date): boolean {
  if (token.usedAt !== null) return false;
  return token.expiresAt.getTime() > now.getTime();
}

export function createPasswordTokenService(options: PasswordTokenServiceOptions): PasswordTokenService {
  const { store } = options;
  const now = options.now ?? (() => new Date());
  const mintToken = options.generateToken ?? generateToken;

  async function issue(userId: string, purpose: PasswordTokenPurpose): Promise<IssuedPasswordToken> {
    // Issuing a new link kills the old ones. Otherwise a member of staff who
    // asked twice would leave a second working key to their account lying in
    // an inbox — and an Admin's reset would not actually cut off a link that
    // had already gone astray.
    await store.revokeAllForUser(userId);

    const token = mintToken();
    const expiresAt = expiryFor(purpose, now());
    await store.create({ userId, tokenHash: hashToken(token), purpose, expiresAt });
    return { token, expiresAt, purpose };
  }

  async function inspect(token: string): Promise<StoredPasswordToken | null> {
    if (!token) return null;
    const stored = await store.findByHash(hashToken(token));
    if (!stored) return null;
    // The hash came back from a unique-index lookup, so it already matches;
    // comparing in constant time anyway keeps the one place a secret is
    // compared free of an early-exit byte comparison.
    if (!tokenHashesMatch(stored.tokenHash, hashToken(token))) return null;
    return isTokenUsable(stored, now()) ? stored : null;
  }

  async function redeem(token: string): Promise<StoredPasswordToken | null> {
    const stored = await inspect(token);
    if (!stored) return null;
    // The conditional update is the single-use gate, not the check above:
    // two redemptions racing each other both pass `inspect`, and exactly one
    // wins here.
    const claimed = await store.markUsed(stored.id, now());
    return claimed ? stored : null;
  }

  return {
    issue,
    inspect,
    redeem,
    revokeAllForUser: (userId: string) => store.revokeAllForUser(userId),
  };
}
