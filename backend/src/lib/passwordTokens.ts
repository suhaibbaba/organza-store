import crypto from "node:crypto";
import {
  PASSWORD_TOKEN_BYTES,
  PASSWORD_TOKEN_TTL_HOURS,
  type PasswordTokenPurpose,
} from "@store/shared/constants/passwordSetup";
import type {
  IssuedPasswordToken,
  PasswordTokenService,
  PasswordTokenServiceOptions,
  StoredPasswordToken,
} from "@/types/passwordSetup";

// Password-link rules with the store injected, so single-use, expiry and never-keeping-the-token can be proven in tests.

/** 32 random bytes, base64url — nothing derived from the user, nothing guessable. */
export function generateToken(): string {
  return crypto.randomBytes(PASSWORD_TOKEN_BYTES).toString("base64url");
}

/** Only the SHA-256 is stored: the token is 256 random bits, so a fast hash suffices and lookup is one indexed read. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Constant-time compare, so a hash is never leaked a byte at a time. */
export function tokenHashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

export function expiryFor(purpose: PasswordTokenPurpose, from: Date): Date {
  return new Date(from.getTime() + PASSWORD_TOKEN_TTL_HOURS[purpose] * 60 * 60 * 1000);
}

/** A token is usable only while unredeemed AND unexpired. Both, every time. */
export function isTokenUsable(token: StoredPasswordToken, now: Date): boolean {
  if (token.usedAt !== null) {
    return false;
  }
  return token.expiresAt.getTime() > now.getTime();
}

export function createPasswordTokenService(options: PasswordTokenServiceOptions): PasswordTokenService {
  const { store } = options;
  const now = options.now ?? (() => new Date());
  const mintToken = options.generateToken ?? generateToken;

  async function issue(userId: string, purpose: PasswordTokenPurpose): Promise<IssuedPasswordToken> {
    // Issuing a new link kills the old ones, so a reset really cuts off a link that went astray.
    await store.revokeAllForUser(userId);

    const token = mintToken();
    const expiresAt = expiryFor(purpose, now());
    await store.create({ userId, tokenHash: hashToken(token), purpose, expiresAt });
    return { token, expiresAt, purpose };
  }

  async function inspect(token: string): Promise<StoredPasswordToken | null> {
    if (!token) {
      return null;
    }
    const stored = await store.findByHash(hashToken(token));
    if (!stored) {
      return null;
    }
    // Already matched by the unique lookup; compared in constant time anyway.
    if (!tokenHashesMatch(stored.tokenHash, hashToken(token))) {
      return null;
    }
    return isTokenUsable(stored, now()) ? stored : null;
  }

  async function redeem(token: string): Promise<StoredPasswordToken | null> {
    const stored = await inspect(token);
    if (!stored) {
      return null;
    }
    // The conditional update is the single-use gate: of two racing redemptions, exactly one wins here.
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
