import { AsyncLocalStorage } from 'node:async_hooks';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema/index.js';

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type Executor = Database | Transaction;

interface Work {
  tx: Transaction;
  afterCommit: (() => Promise<void> | void)[];
}

const current = new AsyncLocalStorage<Work>();

/**
 * Every write in this system runs inside `inTransaction`. The audit row, the idempotency record
 * and the outbox row are written with the same handle, so they commit or roll back together
 * with the business change (rule 3). Nested calls join the outer transaction.
 */
export async function inTransaction<T>(
  db: Database,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const outer = current.getStore();
  if (outer) return work(outer.tx);
  const effects: Work['afterCommit'] = [];
  const result = await db.transaction((tx) =>
    current.run({ tx, afterCommit: effects }, () => work(tx)),
  );
  for (const effect of effects) {
    try {
      await effect();
    } catch {
      // After-commit effects are wake-ups only (e.g. "send the outbox now"); the work they
      // trigger is already recorded and is retried by its own job.
    }
  }
  return result;
}

/** The transaction the caller is running in, if any. */
export function currentTransaction(): Transaction | undefined {
  return current.getStore()?.tx;
}

/** Queues a side effect to run once the surrounding transaction has committed. */
export function afterCommit(effect: () => Promise<void> | void): void {
  const work = current.getStore();
  if (!work) {
    void Promise.resolve()
      .then(effect)
      .catch(() => undefined);
    return;
  }
  work.afterCommit.push(effect);
}

/** Throws when called outside a transaction; used by writers that must never run bare. */
export function requireTransaction(): Transaction {
  const tx = currentTransaction();
  if (!tx) throw new Error('This write must run inside inTransaction()');
  return tx;
}
