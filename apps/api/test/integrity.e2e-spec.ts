import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { AuditService } from '../src/common/services/audit.service.js';
import { IdempotencyService } from '../src/common/services/idempotency.service.js';
import { OutboxService } from '../src/common/services/outbox.service.js';
import { auditLog, outbox, users } from '../src/database/schema/index.js';
import { inTransaction } from '../src/database/unit-of-work.js';
import { createUser, expectDbError, signedIn } from './helpers/fixtures.js';
import { createTestContext, type TestContext } from './helpers/test-app.js';

describe('audit in the same transaction', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(() => ctx.close());

  it('a failed write leaves no audit row, a committed one always has it', async () => {
    const audit = ctx.app.get(AuditService);
    const user = await createUser(ctx, 'EMPLOYEE');
    const marker = randomUUID();
    await expect(
      inTransaction(ctx.db, async (tx) => {
        await tx.update(users).set({ name: 'changed' }).where(eq(users.id, user.id));
        await audit.record(tx, {
          userId: user.id,
          action: 'TEST',
          entity: 'probe',
          entityId: marker,
        });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await ctx.db.select().from(auditLog).where(eq(auditLog.entityId, marker))).toHaveLength(
      0,
    );
    const [still] = await ctx.db.select().from(users).where(eq(users.id, user.id));
    expect(still?.name).not.toBe('changed');

    await inTransaction(ctx.db, (tx) =>
      audit.record(tx, { userId: user.id, action: 'TEST', entity: 'probe', entityId: marker }),
    );
    expect(await ctx.db.select().from(auditLog).where(eq(auditLog.entityId, marker))).toHaveLength(
      1,
    );
  });

  it('a staff change that violates a rule writes neither the change nor the audit', async () => {
    const admin = await signedIn(ctx, 'ADMIN');
    const taken = await createUser(ctx, 'EMPLOYEE');
    const before = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(auditLog);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/staff',
      headers: admin.headers,
      payload: { email: taken.email, name: 'Dup', role: 'EMPLOYEE', password: 'long-enough-1' },
    });
    expect(res.statusCode).toBe(409);
    const after = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(auditLog);
    expect(after[0]?.n).toBe(before[0]?.n);
  });

  it('the audit log is append-only', async () => {
    const user = await createUser(ctx, 'EMPLOYEE');
    await inTransaction(ctx.db, (tx) =>
      ctx.app.get(AuditService).record(tx, { userId: user.id, action: 'X', entity: 'probe' }),
    );
    await expectDbError(
      ctx.db.update(auditLog).set({ action: 'Y' }).where(eq(auditLog.userId, user.id)),
      /append-only/,
    );
    await expectDbError(ctx.db.delete(auditLog).where(eq(auditLog.userId, user.id)), /append-only/);
  });

  it('users are never hard-deleted', async () => {
    const user = await createUser(ctx, 'EMPLOYEE');
    await expectDbError(ctx.db.delete(users).where(eq(users.id, user.id)), /never deleted/);
  });
});

describe('idempotency', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(() => ctx.close());

  it('the same key returns the same result and runs the work once', async () => {
    const service = ctx.app.get(IdempotencyService);
    const key = randomUUID();
    let runs = 0;
    const work = async () => {
      runs++;
      return { id: randomUUID() };
    };
    const first = await service.run('test.once', key, null, { a: 1 }, work);
    const second = await service.run('test.once', key, null, { a: 1 }, work);
    expect(runs).toBe(1);
    expect(second.replayed).toBe(true);
    expect(second.result).toEqual(first.result);
  });

  it('concurrent requests with one key produce one write', async () => {
    const service = ctx.app.get(IdempotencyService);
    const audit = ctx.app.get(AuditService);
    const key = randomUUID();
    const marker = randomUUID();
    const attempt = () =>
      service.run('test.concurrent', key, null, { b: 2 }, async (tx) => {
        await audit.record(tx, {
          userId: null,
          action: 'WRITE',
          entity: 'probe',
          entityId: marker,
        });
        await tx.execute(sql`select pg_sleep(0.05)`);
        return { marker };
      });
    const results = await Promise.all([attempt(), attempt(), attempt(), attempt()]);
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(new Set(results.map((r) => JSON.stringify(r.result))).size).toBe(1);
    expect(await ctx.db.select().from(auditLog).where(eq(auditLog.entityId, marker))).toHaveLength(
      1,
    );
  });

  it('reusing a key for a different request is refused', async () => {
    const service = ctx.app.get(IdempotencyService);
    const key = randomUUID();
    await service.run('test.reuse', key, null, { c: 1 }, async () => ({ ok: true }));
    await expect(
      service.run('test.reuse', key, null, { c: 2 }, async () => ({ ok: true })),
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
  });

  it('a failed write does not burn the key', async () => {
    const service = ctx.app.get(IdempotencyService);
    const key = randomUUID();
    await expect(
      service.run('test.retry', key, null, {}, async () => {
        throw new Error('first try fails');
      }),
    ).rejects.toThrow();
    const retry = await service.run('test.retry', key, null, {}, async () => ({ ok: true }));
    expect(retry).toEqual({ result: { ok: true }, replayed: false });
  });
});

describe('outbox', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(() => ctx.close());

  it('delivers after commit, drops nothing on rollback and retries failures', async () => {
    const service = ctx.app.get(OutboxService);
    const seen: unknown[] = [];
    let failOnce = true;
    service.register('test.topic', async (payload) => {
      if (failOnce) {
        failOnce = false;
        throw new Error('send failed');
      }
      seen.push(payload);
    });
    await expect(
      inTransaction(ctx.db, async (tx) => {
        await service.enqueue(tx, 'test.topic', { n: 'rolled-back' });
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    await inTransaction(ctx.db, (tx) => service.enqueue(tx, 'test.topic', { n: 1 }));
    await service.deliver();
    const [pending] = await ctx.db.select().from(outbox).where(eq(outbox.topic, 'test.topic'));
    expect(pending?.attempts).toBe(1);
    expect(pending?.sentAt).toBeNull();
    await ctx.db
      .update(outbox)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(outbox.topic, 'test.topic'));
    await service.deliver();
    expect(seen).toEqual([{ n: 1 }]);
    const rows = await ctx.db.select().from(outbox).where(eq(outbox.topic, 'test.topic'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sentAt).not.toBeNull();
  });
});
