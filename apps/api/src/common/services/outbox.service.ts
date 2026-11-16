import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { InjectDb } from '../../database/database.module.js';
import { outbox } from '../../database/schema/index.js';
import { afterCommit, type Database, type Transaction } from '../../database/unit-of-work.js';

export type OutboxHandler = (payload: unknown) => Promise<void>;

const MAX_ATTEMPTS = 8;
const POLL_MS = 15_000;
const BATCH = 20;

/**
 * Side effects (push notifications, later e-mail) are rows written in the business
 * transaction and delivered after commit with retries and backoff. A failed send never
 * undoes the business change and is never lost.
 */
@Injectable()
export class OutboxService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Outbox');
  private readonly handlers = new Map<string, OutboxHandler>();
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<number> | undefined;

  constructor(@InjectDb() private readonly db: Database) {}

  onModuleInit(): void {
    if (env().NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.deliver(), POLL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  register(topic: string, handler: OutboxHandler): void {
    this.handlers.set(topic, handler);
  }

  async enqueue(tx: Transaction, topic: string, payload: unknown): Promise<void> {
    await tx.insert(outbox).values({ topic, payload: payload as never });
    afterCommit(() => void this.deliver());
  }

  /** Sends due messages; returns how many were delivered. Safe to call concurrently. */
  deliver(): Promise<number> {
    this.running ??= this.deliverBatch().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async deliverBatch(): Promise<number> {
    const due = await this.db
      .select()
      .from(outbox)
      .where(
        and(
          isNull(outbox.sentAt),
          lte(outbox.nextAttemptAt, sql`now()`),
          lte(outbox.attempts, MAX_ATTEMPTS),
        ),
      )
      .orderBy(asc(outbox.createdAt))
      .limit(BATCH);
    let delivered = 0;
    for (const message of due) {
      const handler = this.handlers.get(message.topic);
      try {
        if (handler) await handler(message.payload);
        await this.db
          .update(outbox)
          .set({ sentAt: new Date(), attempts: message.attempts + 1 })
          .where(eq(outbox.id, message.id));
        delivered++;
      } catch (error) {
        const attempts = message.attempts + 1;
        const delaySeconds = Math.min(3600, 2 ** attempts * 15);
        await this.db
          .update(outbox)
          .set({
            attempts,
            lastError: String(error).slice(0, 500),
            nextAttemptAt: sql`now() + make_interval(secs => ${delaySeconds})`,
          })
          .where(eq(outbox.id, message.id));
        this.logger.warn(`Outbox ${message.topic} failed (attempt ${attempts}): ${String(error)}`);
      }
    }
    return delivered;
  }
}
