import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@organza/shared';
import { and, eq, lt, sql } from 'drizzle-orm';
import { InjectDb } from '../../database/database.module.js';
import { idempotencyKeys } from '../../database/schema/index.js';
import { type Database, inTransaction, type Transaction } from '../../database/unit-of-work.js';
import { conflict } from '../lib/app-error.js';
import { PG, violatedConstraint } from '../lib/postgres-errors.js';
import { requestHash } from '../lib/request-hash.js';

export const IDEMPOTENCY_RETENTION_DAYS = 7;
const PENDING = { pending: true };

export interface IdempotentResult<T> {
  result: T;
  replayed: boolean;
}

/**
 * Same key + scope = same result. The key row is inserted first, inside the business
 * transaction: a concurrent request with the same key blocks on the primary key until the
 * first commits, then fails, rolls back everything it did and reads the stored result.
 */
@Injectable()
export class IdempotencyService {
  constructor(@InjectDb() private readonly db: Database) {}

  async run<T>(
    scope: string,
    key: string,
    userId: string | null,
    body: unknown,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<IdempotentResult<T>> {
    const hash = requestHash(body);
    const earlier = await this.stored<T>(scope, key, hash);
    if (earlier !== undefined) return { result: earlier, replayed: true };
    try {
      const result = await inTransaction(this.db, async (tx) => {
        await tx
          .insert(idempotencyKeys)
          .values({ scope, key, userId, requestHash: hash, response: PENDING });
        const value = await work(tx);
        await tx
          .update(idempotencyKeys)
          .set({ response: (value ?? null) as never })
          .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)));
        return value;
      });
      return { result, replayed: false };
    } catch (error) {
      if (violatedConstraint(error, PG.UNIQUE_VIOLATION) === 'idempotency_keys_scope_key_pk') {
        const replay = await this.stored<T>(scope, key, hash);
        if (replay !== undefined) return { result: replay, replayed: true };
      }
      throw error;
    }
  }

  private async stored<T>(scope: string, key: string, hash: string): Promise<T | undefined> {
    const [row] = await this.db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)));
    if (!row) return undefined;
    if (row.requestHash !== hash) {
      throw conflict(
        ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
        'This key was already used for a different request',
      );
    }
    return row.response as T;
  }

  async purgeExpired(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - IDEMPOTENCY_RETENTION_DAYS * 86_400_000);
    const rows = await this.db
      .delete(idempotencyKeys)
      .where(lt(idempotencyKeys.createdAt, cutoff))
      .returning({ key: idempotencyKeys.key });
    return rows.length;
  }

  /** For tests. */
  async count(scope: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.scope, scope));
    return row?.n ?? 0;
  }
}
