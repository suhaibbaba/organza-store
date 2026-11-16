import { Injectable } from '@nestjs/common';
import type { createUserSchema, updateUserSchema } from '@organza/shared';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../../common/decorators/auth.decorators.js';
import { conflict, notFound } from '../../../common/lib/app-error.js';
import { PG, violatedConstraint } from '../../../common/lib/postgres-errors.js';
import { AuditService } from '../../../common/services/audit.service.js';
import { InjectDb } from '../../../database/database.module.js';
import { users } from '../../../database/schema/index.js';
import { type Database, inTransaction } from '../../../database/unit-of-work.js';
import { PasswordService } from '../../auth/services/password.service.js';
import { SessionStateService } from '../../auth/services/session-state.service.js';
import { TokenService } from '../../auth/services/token.service.js';

export const STAFF_ERRORS = {
  EMAIL_TAKEN: 'STAFF_EMAIL_TAKEN',
  LAST_ADMIN: 'STAFF_LAST_ADMIN',
  SELF_DEACTIVATE: 'STAFF_SELF_DEACTIVATE',
} as const;

const publicColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  phone: users.phone,
  role: users.role,
  language: users.language,
  isActive: users.isActive,
  createdAt: users.createdAt,
};

export type StaffRow = { [K in keyof typeof publicColumns]: (typeof users.$inferSelect)[K] };

@Injectable()
export class UsersService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionStateService,
  ) {}

  list(): Promise<StaffRow[]> {
    return this.db.select(publicColumns).from(users).orderBy(asc(users.name));
  }

  async create(actor: Actor | null, input: z.output<typeof createUserSchema>): Promise<StaffRow> {
    const passwordHash = await this.passwords.hash(input.password);
    try {
      return await inTransaction(this.db, async (tx) => {
        const [row] = await tx
          .insert(users)
          .values({
            email: input.email,
            name: input.name,
            phone: input.phone ?? null,
            role: input.role,
            language: input.language,
            passwordHash,
          })
          .returning(publicColumns);
        if (!row) throw new Error('user not inserted');
        await this.audit.record(tx, {
          userId: actor?.id ?? null,
          action: 'CREATE',
          entity: 'user',
          entityId: row.id,
          newValue: row,
        });
        return row;
      });
    } catch (error) {
      if (violatedConstraint(error, PG.UNIQUE_VIOLATION) === 'users_email_uniq') {
        throw conflict(STAFF_ERRORS.EMAIL_TAKEN, 'Email already used');
      }
      throw error;
    }
  }

  async update(
    actor: Actor,
    id: string,
    input: z.output<typeof updateUserSchema>,
  ): Promise<StaffRow> {
    const passwordHash = input.password ? await this.passwords.hash(input.password) : undefined;
    const row = await inTransaction(this.db, async (tx) => {
      const [before] = await tx
        .select(publicColumns)
        .from(users)
        .where(eq(users.id, id))
        .for('update');
      if (!before) throw notFound('User');
      if (id === actor.id && input.isActive === false) {
        throw conflict(STAFF_ERRORS.SELF_DEACTIVATE, 'You cannot deactivate yourself');
      }
      const losesAdmin =
        before.role === 'ADMIN' &&
        before.isActive &&
        ((input.role && input.role !== 'ADMIN') || input.isActive === false);
      if (losesAdmin) {
        // Serialise admin removals so two concurrent demotions cannot leave zero admins.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('organza:admins'))`);
        const [others] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(users)
          .where(and(eq(users.role, 'ADMIN'), eq(users.isActive, true), ne(users.id, id)));
        if (!others?.n)
          throw conflict(STAFF_ERRORS.LAST_ADMIN, 'At least one active admin is required');
      }
      const [after] = await tx
        .update(users)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.phone !== undefined && { phone: input.phone }),
          ...(input.role !== undefined && { role: input.role }),
          ...(input.language !== undefined && { language: input.language }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          ...(passwordHash && { passwordHash }),
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning(publicColumns);
      if (!after) throw notFound('User');
      await this.audit.record(tx, {
        userId: actor.id,
        action: passwordHash ? 'UPDATE_WITH_PASSWORD' : 'UPDATE',
        entity: 'user',
        entityId: id,
        oldValue: before,
        newValue: after,
      });
      return after;
    });
    if (input.isActive === false || input.role || passwordHash)
      await this.tokens.revokeAllForUser(id);
    this.sessions.forget(id);
    return row;
  }
}
