import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Role } from '@organza/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import { env } from '../../../config/env.js';
import { InjectDb } from '../../../database/database.module.js';
import { refreshTokens } from '../../../database/schema/index.js';
import type { Database } from '../../../database/unit-of-work.js';
import { REFRESH_TOKEN_BYTES, SESSION_REFRESH_TTL_HOURS } from '../constants.js';

export interface AccessClaims {
  sub: string;
  role: Role;
}

@Injectable()
export class TokenService {
  private readonly secret = new TextEncoder().encode(env().JWT_SECRET);

  constructor(@InjectDb() private readonly db: Database) {}

  get accessTtlSeconds(): number {
    return env().JWT_ACCESS_TTL_SECONDS;
  }

  createAccessToken(user: { id: string; role: Role }): Promise<string> {
    return new SignJWT({ role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${this.accessTtlSeconds}s`)
      .sign(this.secret);
  }

  async verifyAccessToken(token: string): Promise<AccessClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret, { algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || typeof payload['role'] !== 'string') return null;
      return { sub: payload.sub, role: payload['role'] as Role };
    } catch {
      return null;
    }
  }

  digest(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issueRefreshToken(userId: string, persistent: boolean, client: string) {
    const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const lifetimeMs = persistent
      ? env().JWT_REFRESH_TTL_DAYS * 86_400_000
      : SESSION_REFRESH_TTL_HOURS * 3_600_000;
    const [row] = await this.db
      .insert(refreshTokens)
      .values({
        userId,
        tokenHash: this.digest(token),
        persistent,
        client,
        expiresAt: new Date(Date.now() + lifetimeMs),
      })
      .returning({ id: refreshTokens.id });
    if (!row) throw new Error('refresh token not stored');
    return { id: row.id, token };
  }

  async findByToken(token: string) {
    const [row] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, this.digest(token)));
    return row;
  }

  /** Atomic claim: of two concurrent refreshes with the same token only one wins. */
  async revoke(id: string): Promise<boolean> {
    const claimed = await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id });
    return claimed.length === 1;
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(refreshTokens).where(eq(refreshTokens.id, id));
    return row;
  }

  /** Atomic rotation: revokes a live token and names its successor in one claim. */
  async rotate(id: string, replacedById: string): Promise<boolean> {
    const claimed = await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), replacedById })
      .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id });
    return claimed.length === 1;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }
}
