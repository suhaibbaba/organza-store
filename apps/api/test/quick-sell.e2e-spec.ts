import { randomUUID } from 'node:crypto';
import type { Page, ProductSummary, ProductView } from '@organza/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCategory } from './helpers/catalogue.js';
import { signedIn } from './helpers/fixtures.js';
import { cash, createRegister, openShift, sell } from './helpers/sales.js';
import { createTestContext, type TestContext } from './helpers/test-app.js';

type Headers = Record<string, string>;

describe('quick sell', () => {
  let ctx: TestContext;
  let admin: Awaited<ReturnType<typeof signedIn>>;
  let employee: Awaited<ReturnType<typeof signedIn>>;
  let manager: Awaited<ReturnType<typeof signedIn>>;

  const quick = async (headers: Headers, name: string, price = '35.00') => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/products/quick-sell',
      headers,
      payload: { idempotencyKey: randomUUID(), name: { ar: name }, price },
    });
    if (res.statusCode !== 201) throw new Error(`quick ${res.statusCode} ${res.body}`);
    return res.json<ProductView>();
  };
  const review = (headers: Headers, p: ProductView, outcome: string) =>
    ctx.app.inject({
      method: 'POST',
      url: `/products/${p.id}/quick-sell-review`,
      headers,
      payload: { version: p.version, outcome },
    });
  const waiting = async () =>
    (
      await ctx.app.inject({
        method: 'GET',
        url: '/products?needsCompletion=true&status=ALL',
        headers: manager.headers,
      })
    )
      .json<Page<ProductSummary>>()
      .items.map((i) => i.id);

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await signedIn(ctx, 'ADMIN');
    employee = await signedIn(ctx, 'EMPLOYEE');
    manager = await signedIn(ctx, 'MANAGER');
  });
  afterAll(() => ctx.close());

  it('sells a piece known only by name and price, then waits for a manager to complete it', async () => {
    const p = await quick(employee.headers, 'حزام جلد');
    expect(p).toMatchObject({
      completedAt: null,
      oneOffAt: null,
      categoryId: null,
      price: '35.00',
    });
    expect(p.quickSoldAt).toBeTruthy();
    const shift = await openShift(ctx, employee.headers, (await createRegister(ctx)).id);
    const sale = await sell(ctx, employee.headers, {
      shiftId: shift.id,
      lines: [{ itemId: p.items[0]!.id, quantity: 1, unitPrice: '35.00' }],
      payments: [cash('35.00')],
    });
    expect(sale.total).toBe('35.00');
    expect(await waiting()).toContain(p.id);

    expect((await review(employee.headers, p, 'COMPLETED')).statusCode).toBe(403);
    expect((await review(manager.headers, p, 'COMPLETED')).json<{ code: string }>().code).toBe(
      'CATEGORY_REQUIRED',
    );
    const category = await createCategory(ctx, admin.headers);
    const edited = await ctx.app.inject({
      method: 'PATCH',
      url: `/products/${p.id}`,
      headers: manager.headers,
      payload: { version: p.version, categoryId: category.id },
    });
    const done = await review(manager.headers, edited.json<ProductView>(), 'COMPLETED');
    expect(done.statusCode).toBe(201);
    expect(done.json<ProductView>().completedAt).toBeTruthy();
    expect(await waiting()).not.toContain(p.id);
  });

  it('a one-off leaves the queue without a category', async () => {
    const p = await quick(employee.headers, 'قطعة من معرض');
    const res = await review(manager.headers, p, 'ONE_OFF');
    expect(res.json<ProductView>().oneOffAt).toBeTruthy();
    expect((await review(manager.headers, res.json<ProductView>(), 'ONE_OFF')).statusCode).toBe(
      409,
    );
  });
});
