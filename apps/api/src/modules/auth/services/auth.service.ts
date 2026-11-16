import { Injectable, Logger } from '@nestjs/common';
import {
  capabilitiesFor,
  ERROR_CODES,
  type LoginResponse,
  type SessionUser,
} from '@organza/shared';
import { eq, sql } from 'drizzle-orm';
import { AppError } from '../../../common/lib/app-error.js';
import { AuditService } from '../../../common/services/audit.service.js';
import { InjectDb } from '../../../database/database.module.js';
import { users } from '../../../database/schema/index.js';
import { type Database, inTransaction } from '../../../database/unit-of-work.js';
import { LoginThrottleService } from './login-throttle.service.js';
import { PasswordService } from './password.service.js';
import { SessionStateService } from './session-state.service.js';
import { TokenService } from './token.service.js';

type UserRow = typeof users.$inferSelect;

const invalidLogin = () =>
  new AppError(401, ERROR_CODES.LOGIN_INVALID, 'Invalid email or password');
/** How long a just-rotated refresh token still leads to its successor instead of counting as theft. */
const REFRESH_REUSE_GRACE_MS = 30_000;
const MAX_CHAIN_HOPS = 10;
/** Requests that lose the rotation race follow the chain and try again, a bounded number of times. */
const MAX_ROTATION_ATTEMPTS = 6;

const invalidRefresh = () =>
  new AppError(401, ERROR_CODES.UNAUTHENTICATED, 'Invalid refresh token');

export interface IssuedSession extends LoginResponse {
  refreshToken: string;
  persistent: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly throttle: LoginThrottleService,
    private readonly sessions: SessionStateService,
    private readonly audit: AuditService,
  ) {}

  async login(
    email: string,
    password: string,
    persistent: boolean,
    client: string,
  ): Promise<IssuedSession> {
    const key = email.toLowerCase();
    const locked = await this.throttle.lockedUntil(key);
    if (locked) {
      throw new AppError(429, ERROR_CODES.LOGIN_LOCKED, 'Too many attempts', {
        until: locked.toISOString(),
      });
    }
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(sql`lower(${users.email})`, key));
    if (!user) {
      await this.passwords.burnTiming(password);
      await this.throttle.recordFailure(key);
      throw invalidLogin();
    }
    const legacy = user.legacyPasswordHash
      ? await this.passwords.verifyLegacy(user.legacyPasswordHash, password)
      : false;

    if (!(legacy || (await this.passwords.verify(user.passwordHash, password))) || !user.isActive) {
      await this.throttle.recordFailure(key);
      throw invalidLogin();
    }

    await this.throttle.clear(key);

    const rehashed = legacy ? await this.passwords.hash(password) : null;
    await inTransaction(this.db, async (tx) => {
      if (rehashed) {
        // The old system's hash is used once, then replaced: nobody has to reset a password.
        await tx
          .update(users)
          .set({ passwordHash: rehashed, legacyPasswordHash: null })
          .where(eq(users.id, user.id));
        await this.audit.record(tx, {
          userId: user.id,
          action: 'PASSWORD_REHASHED',
          entity: 'user',
          entityId: user.id,
        });
      }
      await this.audit.record(tx, {
        userId: user.id,
        action: 'LOGIN',
        entity: 'user',
        entityId: user.id,
        newValue: { client },
      });
    });
    return this.startSession(user, persistent, client);
  }

  async refresh(presented: string, attempt = 0): Promise<IssuedSession> {
    let stored = await this.tokens.findByToken(presented);
    if (!stored) throw invalidRefresh();
    // A token rotated moments ago is a race, not theft: two tabs refreshing together, or a page
    // reloaded while its refresh was in flight (the new cookie never landed). Within the grace
    // window, carry on from the newest token of the same chain (docs/assumptions.md 53).
    for (
      let hop = 0;
      stored.revokedAt &&
      stored.replacedById &&
      hop < MAX_CHAIN_HOPS &&
      Date.now() - stored.revokedAt.getTime() <= REFRESH_REUSE_GRACE_MS;
      hop++
    ) {
      const next = await this.tokens.findById(stored.replacedById);
      if (!next) break;
      stored = next;
    }
    if (stored.revokedAt) {
      // A rotated token came back late: someone else may hold it. End every session of this user.
      this.logger.warn(`Refresh token reuse for user ${stored.userId}; revoking all sessions`);
      await this.tokens.revokeAllForUser(stored.userId);
      throw invalidRefresh();
    }
    if (stored.expiresAt.getTime() <= Date.now()) throw invalidRefresh();
    const [user] = await this.db.select().from(users).where(eq(users.id, stored.userId));
    if (!user?.isActive) {
      await this.tokens.revokeAllForUser(stored.userId);
      throw invalidRefresh();
    }
    const session = await this.startSession(user, stored.persistent, stored.client);
    const replacement = await this.tokens.findByToken(session.refreshToken);
    if (!replacement) throw invalidRefresh();
    // Revoking the old token and naming its successor is one atomic claim, so a request that
    // loses the race always finds the chain to follow.
    if (!(await this.tokens.rotate(stored.id, replacement.id))) {
      await this.tokens.revoke(replacement.id);
      if (attempt + 1 >= MAX_ROTATION_ATTEMPTS) throw invalidRefresh();
      return this.refresh(presented, attempt + 1);
    }
    return session;
  }

  async logout(presented: string | undefined): Promise<void> {
    if (!presented) return;
    const stored = await this.tokens.findByToken(presented);
    if (stored) await this.tokens.revoke(stored.id);
  }

  async me(userId: string): Promise<SessionUser> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw invalidRefresh();
    return toSessionUser(user);
  }

  async changeOwnPassword(userId: string, current: string, next: string): Promise<void> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user || !(await this.passwords.verify(user.passwordHash, current))) throw invalidLogin();
    const passwordHash = await this.passwords.hash(next);
    await inTransaction(this.db, async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, userId));
      await this.audit.record(tx, {
        userId,
        action: 'PASSWORD_CHANGED',
        entity: 'user',
        entityId: userId,
      });
    });
    await this.tokens.revokeAllForUser(userId);
    this.sessions.forget(userId);
  }

  private async startSession(
    user: UserRow,
    persistent: boolean,
    client: string,
  ): Promise<IssuedSession> {
    const refresh = await this.tokens.issueRefreshToken(user.id, persistent, client);
    return {
      accessToken: await this.tokens.createAccessToken(user),
      expiresIn: this.tokens.accessTtlSeconds,
      user: toSessionUser(user),
      refreshToken: refresh.token,
      persistent,
    };
  }
}

export function toSessionUser(user: UserRow): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    language: user.language,
    capabilities: capabilitiesFor(user.role),
  };
}
