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

  async refresh(presented: string): Promise<IssuedSession> {
    const stored = await this.tokens.findByToken(presented);
    if (!stored) throw invalidRefresh();
    if (stored.revokedAt) {
      // A rotated token came back: someone else may hold it. End every session of this user.
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
    if (!(await this.tokens.revoke(stored.id))) {
      await this.tokens.revokeAllForUser(stored.userId);
      throw invalidRefresh();
    }
    const session = await this.startSession(user, stored.persistent, stored.client);
    const replacement = await this.tokens.findByToken(session.refreshToken);
    if (replacement) await this.tokens.linkReplacement(stored.id, replacement.id);
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
