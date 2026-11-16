import { randomUUID } from 'node:crypto';
import type { CustomerView, SaleView, ShiftView } from '@organza/shared';
import { registers } from '../../src/database/schema/index.js';
import type { TestContext } from './test-app.js';

type Headers = Record<string, string>;

/** Each test file gets its own till so shifts never collide across files. */
export async function createRegister(ctx: TestContext, name = `Till ${randomUUID().slice(0, 6)}`) {
  const [row] = await ctx.db.insert(registers).values({ name }).returning();
  return row!;
}

export async function openShift(
  ctx: TestContext,
  headers: Headers,
  registerId: string,
  float: { currency: string; amount: string }[] = [{ currency: 'ILS', amount: '200.00' }],
  note?: string,
) {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/shifts',
    headers,
    payload: { registerId, float, note },
  });
  if (res.statusCode !== 201) throw new Error(`shift ${res.statusCode} ${res.body}`);
  return res.json<ShiftView>();
}

export async function createCustomer(
  ctx: TestContext,
  headers: Headers,
  payload: Record<string, unknown> = {},
) {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/customers',
    headers,
    payload: { name: `زبونة ${randomUUID().slice(0, 4)}`, ...payload },
  });
  if (res.statusCode !== 201) throw new Error(`customer ${res.statusCode} ${res.body}`);
  return res.json<CustomerView>();
}

export function checkout(ctx: TestContext, headers: Headers, payload: Record<string, unknown>) {
  return ctx.app.inject({
    method: 'POST',
    url: '/sales',
    headers,
    payload: { idempotencyKey: randomUUID(), ...payload },
  });
}

export async function sell(ctx: TestContext, headers: Headers, payload: Record<string, unknown>) {
  const res = await checkout(ctx, headers, payload);
  if (res.statusCode !== 201) throw new Error(`sale ${res.statusCode} ${res.body}`);
  return res.json<SaleView>();
}

export const cash = (amount: string, currency = 'ILS') => ({ method: 'CASH', currency, amount });
