import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StockService } from '../src/modules/stock/services/stock.service.js';
import { createCategory, createProduct } from './helpers/catalogue.js';
import { signedIn } from './helpers/fixtures.js';
import { createTestContext, type TestContext } from './helpers/test-app.js';

describe('stock adjustments and counts', () => {
  let ctx: TestContext;
  let manager: Awaited<ReturnType<typeof signedIn>>;
  let employee: Awaited<ReturnType<typeof signedIn>>;
  let categoryId: string;

  const item = async (stock = 5) =>
    (
      await createProduct(ctx, manager.headers, {
        type: 'REGULAR',
        name: { ar: `قطعة ${randomUUID().slice(0, 4)}` },
        categoryId,
        stock,
      })
    ).items[0]!.id;
  const balance = async (itemId: string) =>
    (await ctx.app.get(StockService).balances(ctx.db, [itemId])).get(itemId)!;
  const adjust = (payload: Record<string, unknown>, headers = manager.headers) =>
    ctx.app.inject({
      method: 'POST',
      url: '/stock/adjustments',
      headers,
      payload: { idempotencyKey: randomUUID(), ...payload },
    });

  beforeAll(async () => {
    ctx = await createTestContext();
    manager = await signedIn(ctx, 'MANAGER');
    employee = await signedIn(ctx, 'EMPLOYEE');
    categoryId = (await createCategory(ctx, manager.headers)).id;
  });
  afterAll(() => ctx.close());

  it('employees cannot adjust stock', async () => {
    const id = await item();
    expect(
      (await adjust({ reason: 'LOSS', lines: [{ itemId: id, delta: -1 }] }, employee.headers))
        .statusCode,
    ).toBe(403);
  });

  it('moves damaged pieces aside and writes them off', async () => {
    const id = await item(5);
    const res = await adjust({
      reason: 'DAMAGE',
      note: 'torn',
      lines: [{ itemId: id, delta: -2 }],
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().number).toMatch(/^ADJ-\d{4}-\d{4}$/);
    expect(await balance(id)).toMatchObject({ onHand: 3, damaged: 2 });
    await adjust({ reason: 'WRITE_OFF_DAMAGED', lines: [{ itemId: id, delta: -2 }] });
    expect(await balance(id)).toMatchObject({ onHand: 3, damaged: 0 });
  });

  it('a correction from a counted quantity sets on-hand to what was counted', async () => {
    const id = await item(5);
    const res = await adjust({ reason: 'COUNT_ADJUSTMENT', lines: [{ itemId: id, counted: 7 }] });
    expect(res.json().lines[0]).toMatchObject({
      delta: 2,
      countedQuantity: 7,
      previousQuantity: 5,
    });
    expect((await balance(id)).onHand).toBe(7);
  });

  it('refuses a reason going the wrong way', async () => {
    const id = await item();
    expect(
      (await adjust({ reason: 'FOUND', lines: [{ itemId: id, delta: -1 }] })).json().code,
    ).toBe('ADJUSTMENT_WRONG_SIGN');
  });

  it('reverses an adjustment once, restoring stock', async () => {
    const id = await item(4);
    const doc = (await adjust({ reason: 'LOSS', lines: [{ itemId: id, delta: -3 }] })).json();
    const rev = await ctx.app.inject({
      method: 'POST',
      url: `/stock/adjustments/${doc.id}/reverse`,
      headers: manager.headers,
      payload: { reason: 'wrong item' },
    });
    expect(rev.json().reversed).toBe(true);
    expect((await balance(id)).onHand).toBe(4);
    const again = await ctx.app.inject({
      method: 'POST',
      url: `/stock/adjustments/${doc.id}/reverse`,
      headers: manager.headers,
      payload: { reason: 'x' },
    });
    expect(again.json().code).toBe('ALREADY_REVERSED');
  });

  it('two managers adjusting the same item at once both land', async () => {
    const id = await item(10);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        adjust({ reason: 'LOSS', lines: [{ itemId: id, delta: -1 }] }).then((r) => r.statusCode),
      ),
    );
    expect(results.every((s) => s === 201)).toBe(true);
    expect((await balance(id)).onHand).toBe(5);
  });

  it('posts a count: only counted items change, by the difference at posting time', async () => {
    const a = await item(5);
    const b = await item(3);
    const untouched = await item(2);
    const count = (
      await ctx.app.inject({
        method: 'POST',
        url: '/stock/counts',
        headers: manager.headers,
        payload: { title: 'Shelf A' },
      })
    ).json();
    expect(count.number).toMatch(/^CNT-/);
    await ctx.app.inject({
      method: 'POST',
      url: `/stock/counts/${count.id}/lines`,
      headers: manager.headers,
      payload: {
        lines: [
          { itemId: a, counted: 4 },
          { itemId: b, counted: 3 },
        ],
      },
    });
    // A sale-like movement happens between counting and posting: posting uses the live figure.
    await adjust({ reason: 'FOUND', lines: [{ itemId: a, delta: 1 }] });
    const posted = await ctx.app.inject({
      method: 'POST',
      url: `/stock/counts/${count.id}/post`,
      headers: manager.headers,
    });
    expect(posted.json().status).toBe('POSTED');
    expect(posted.json().lines.find((l: { itemId: string }) => l.itemId === a)).toMatchObject({
      counted: 4,
      system: 6,
      difference: -2,
    });
    expect((await balance(a)).onHand).toBe(4);
    expect((await balance(b)).onHand).toBe(3);
    expect((await balance(untouched)).onHand).toBe(2);
    const late = await ctx.app.inject({
      method: 'POST',
      url: `/stock/counts/${count.id}/lines`,
      headers: manager.headers,
      payload: { lines: [{ itemId: a, counted: 1 }] },
    });
    expect(late.json().code).toBe('COUNT_NOT_OPEN');
    expect(await ctx.app.get(StockService).verify()).toEqual([]);
  });

  it('lists stock with low-stock flags and an item history', async () => {
    const id = await item(1);
    const list = await ctx.app.inject({
      method: 'GET',
      url: '/stock?lowStock=true&pageSize=200',
      headers: employee.headers,
    });
    expect(list.json().items.some((r: { itemId: string }) => r.itemId === id)).toBe(true);
    const history = await ctx.app.inject({
      method: 'GET',
      url: `/stock/items/${id}/history`,
      headers: manager.headers,
    });
    expect(history.json()[0]).toMatchObject({ quantity: 1, reason: 'INITIAL' });
  });
});

describe('daily jobs', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(() => ctx.close());

  it('runs a daily job once per date even when two instances race', async () => {
    const { JobsService } = await import('../src/modules/jobs/jobs.service.js');
    const jobs = ctx.app.get(JobsService);
    let runs = 0;
    const job = { name: `probe-${randomUUID()}`, hour: 0, run: async () => ++runs };
    const results = await Promise.all([
      jobs.runOnce(job, '2026-01-01'),
      jobs.runOnce(job, '2026-01-01'),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(runs).toBe(1);
    await jobs.runOnce(job, '2026-01-02');
    expect(runs).toBe(2);
  });
});
