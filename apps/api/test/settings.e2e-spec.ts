import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { exchangeRates } from '../src/database/schema/index.js';
import { expectDbError, signedIn } from './helpers/fixtures.js';
import { createTestContext, type TestContext } from './helpers/test-app.js';

describe('settings and currencies', () => {
  let ctx: TestContext;
  let admin: Awaited<ReturnType<typeof signedIn>>;
  let manager: Awaited<ReturnType<typeof signedIn>>;
  let employee: Awaited<ReturnType<typeof signedIn>>;
  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await signedIn(ctx, 'ADMIN');
    manager = await signedIn(ctx, 'MANAGER');
    employee = await signedIn(ctx, 'EMPLOYEE');
  });
  afterAll(() => ctx.close());

  it('returns defaults and lets only admins change them', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/settings',
      headers: employee.headers,
    });
    expect(res.json()).toMatchObject({
      lowStockThreshold: 3,
      heldReminderDays: 30,
      employeeRefundLimit: '200.00',
    });
    const denied = await ctx.app.inject({
      method: 'PATCH',
      url: '/settings',
      headers: manager.headers,
      payload: { lowStockThreshold: 5 },
    });
    expect(denied.statusCode).toBe(403);
    const ok = await ctx.app.inject({
      method: 'PATCH',
      url: '/settings',
      headers: admin.headers,
      payload: { lowStockThreshold: 5, employeeRefundLimit: 150 },
    });
    expect(ok.json()).toMatchObject({
      lowStockThreshold: 5,
      employeeRefundLimit: '150.00',
      heldReminderDays: 30,
    });
  });

  it('starts with the shekel as the only, default currency', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/currencies',
      headers: employee.headers,
    });
    expect(res.json()[0]).toMatchObject({ code: 'ILS', isDefault: true, rate: '1' });
  });

  it('adds a currency and keeps every rate as history', async () => {
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/currencies',
      headers: admin.headers,
      payload: { code: 'usd', rate: '3.65' },
    });
    expect(created.json()).toMatchObject({ code: 'USD', rate: '3.65', isDefault: false });
    const byEmployee = await ctx.app.inject({
      method: 'PUT',
      url: '/currencies/USD/rate',
      headers: employee.headers,
      payload: { rate: '3.7' },
    });
    expect(byEmployee.statusCode).toBe(403);
    const byManager = await ctx.app.inject({
      method: 'PUT',
      url: '/currencies/USD/rate',
      headers: manager.headers,
      payload: { rate: '3.70' },
    });
    expect(byManager.json().rate).toBe('3.7');
    const history = await ctx.db
      .select()
      .from(exchangeRates)
      .where(eq(exchangeRates.currency, 'USD'));
    expect(history).toHaveLength(2);
    await expectDbError(
      ctx.db.update(exchangeRates).set({ rate: '9' }).where(eq(exchangeRates.currency, 'USD')),
      /append-only/,
    );
  });

  it('refuses a rate on the default currency and deactivating it', async () => {
    const rate = await ctx.app.inject({
      method: 'PUT',
      url: '/currencies/ILS/rate',
      headers: admin.headers,
      payload: { rate: '2' },
    });
    expect(rate.json().code).toBe('CURRENCY_DEFAULT_RATE');
    const off = await ctx.app.inject({
      method: 'PATCH',
      url: '/currencies/ILS',
      headers: admin.headers,
      payload: { isActive: false },
    });
    expect(off.json().code).toBe('CURRENCY_DEFAULT_INACTIVE');
    const bad = await ctx.app.inject({
      method: 'POST',
      url: '/currencies',
      headers: admin.headers,
      payload: { code: 'JOD', rate: '0' },
    });
    expect(bad.statusCode).toBe(400);
  });
});
