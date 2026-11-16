import { randomUUID } from 'node:crypto';
import type {
  CourierSettlementView,
  CourierView,
  CustomerView,
  OrderView,
  SaleView,
  ShiftView,
} from '@organza/shared';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { itemBalances, orderEvents, orders } from '../src/database/schema/index.js';
import { createCategory, createProduct } from './helpers/catalogue.js';
import { expectDbError, signedIn } from './helpers/fixtures.js';
import { cash, createCustomer, createRegister, openShift } from './helpers/sales.js';
import { createTestContext, type TestContext } from './helpers/test-app.js';

type Headers = Record<string, string>;

describe('orders and couriers', () => {
  let ctx: TestContext;
  let admin: Awaited<ReturnType<typeof signedIn>>;
  let employee: Awaited<ReturnType<typeof signedIn>>;
  let categoryId: string;
  let shift: ShiftView;
  let courier: CourierView;

  const newProduct = async (stock = 5, price = '100.00') =>
    createProduct(ctx, admin.headers, {
      type: 'REGULAR',
      name: { ar: `عباية ${randomUUID().slice(0, 4)}` },
      categoryId,
      stock,
      price,
      cost: '40.00',
    });
  const post = (
    url: string,
    payload: Record<string, unknown> = {},
    headers: Headers = employee.headers,
  ) => ctx.app.inject({ method: 'POST', url, headers, payload });
  const ok = async <T>(res: Awaited<ReturnType<typeof post>>, status = 201) => {
    if (res.statusCode !== status) throw new Error(`${res.statusCode} ${res.body}`);
    return res.json<T>();
  };
  const order = async (
    customer: CustomerView,
    lines: { itemId: string; quantity: number }[],
    extra = {},
  ) =>
    ok<OrderView>(
      await post('/orders', {
        idempotencyKey: randomUUID(),
        customerId: customer.id,
        courierId: courier.id,
        lines,
        ...extra,
      }),
    );
  const balance = async (itemId: string) =>
    (await ctx.db.select().from(itemBalances).where(eq(itemBalances.itemId, itemId)))[0]!;
  const courierNow = async () =>
    (
      await ctx.app.inject({
        method: 'GET',
        url: `/couriers/${courier.id}`,
        headers: admin.headers,
      })
    ).json<CourierView>();
  const toReady = async (id: string) => {
    await ok(await post(`/orders/${id}/confirm`));
    await ok(await post(`/orders/${id}/prepare`));
    return ok<OrderView>(await post(`/orders/${id}/ready`));
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await signedIn(ctx, 'ADMIN');
    employee = await signedIn(ctx, 'EMPLOYEE');
    categoryId = (await createCategory(ctx, admin.headers)).id;
    shift = await openShift(ctx, employee.headers, (await createRegister(ctx)).id);
    courier = await ok<CourierView>(
      await post('/couriers', { name: `شركة توصيل ${randomUUID().slice(0, 4)}` }, admin.headers),
    );
  });
  afterAll(() => ctx.close());

  it('a WhatsApp order: confirm reserves, a double click changes nothing, hand-over makes the sale', async () => {
    const p = await newProduct(3, '150.00');
    const itemId = p.items[0]!.id;
    const customer = await createCustomer(ctx, employee.headers);
    const o = await order(customer, [{ itemId, quantity: 2 }]);
    expect(o).toMatchObject({ status: 'NEW', total: '300.00', source: 'WHATSAPP' });
    expect((await balance(itemId)).reserved).toBe(0);

    const [a, b] = await Promise.all([
      post(`/orders/${o.id}/confirm`),
      post(`/orders/${o.id}/confirm`),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([201, 201]);
    expect((await balance(itemId)).reserved).toBe(2);
    const events = await ctx.db.select().from(orderEvents).where(eq(orderEvents.orderId, o.id));
    expect(events.filter((e) => e.toStatus === 'CONFIRMED')).toHaveLength(1);

    // A step from the wrong status is refused.
    const early = await post(`/orders/${o.id}/ship`, { idempotencyKey: randomUUID() });
    expect(early.json<{ code: string }>().code).toBe('ORDER_WRONG_STATUS');

    // A deposit by bank transfer before it goes out.
    await ok(
      await post(`/orders/${o.id}/deposits`, {
        idempotencyKey: randomUUID(),
        payment: { method: 'BANK_TRANSFER', currency: 'ILS', amount: '100.00' },
      }),
    );
    await toReady(o.id);
    const out = await ok<OrderView>(
      await post(`/orders/${o.id}/ship`, { idempotencyKey: randomUUID() }),
    );
    expect(out).toMatchObject({ status: 'OUT', deposit: '100.00', cod: '200.00' });
    expect(await balance(itemId)).toMatchObject({ onHand: 1, reserved: 0 });
    const sale = (
      await ctx.app.inject({ method: 'GET', url: `/sales/${out.saleId}`, headers: admin.headers })
    ).json<SaleView>();
    expect(sale).toMatchObject({ total: '300.00', paid: '300.00', source: 'WHATSAPP' });
    expect(sale.payments.map((x) => x.method).sort()).toEqual(['COURIER', 'STORE_CREDIT']);
    expect((await courierNow()).balance).toBe('200.00');
  });

  it('short stock: confirm reserves what there is, ready is refused until the line is reduced', async () => {
    const p = await newProduct(1);
    const itemId = p.items[0]!.id;
    const customer = await createCustomer(ctx, employee.headers);
    const o = await order(customer, [{ itemId, quantity: 3 }]);
    const confirmed = await ok<OrderView>(await post(`/orders/${o.id}/confirm`));
    expect(confirmed.lines[0]).toMatchObject({ quantity: 3, reserved: 1 });
    expect(confirmed.short).toBe(1);
    await ok(await post(`/orders/${o.id}/prepare`));
    const refused = await post(`/orders/${o.id}/ready`);
    expect(refused.json<{ code: string }>().code).toBe('ORDER_NOT_RESERVED');
    const current = (
      await ctx.app.inject({ method: 'GET', url: `/orders/${o.id}`, headers: employee.headers })
    ).json<OrderView>();
    const edited = await ok<OrderView>(
      await ctx.app.inject({
        method: 'PATCH',
        url: `/orders/${o.id}`,
        headers: employee.headers,
        payload: { version: current.version, lines: [{ itemId, quantity: 1 }] },
      }),
      200,
    );
    expect(edited.lines[0]).toMatchObject({ quantity: 1, reserved: 1 });
    expect((await balance(itemId)).reserved).toBe(1);
    expect((await ok<OrderView>(await post(`/orders/${o.id}/ready`))).status).toBe('READY');
  });

  it('a quoted price is kept when the catalogue price rises before hand-over', async () => {
    const p = await newProduct(2, '100.00');
    const customer = await createCustomer(ctx, employee.headers);
    const o = await order(customer, [{ itemId: p.items[0]!.id, quantity: 1 }], {
      delivery: 'PICKUP',
      courierId: undefined,
    });
    await ctx.app.inject({
      method: 'PATCH',
      url: `/products/${p.id}`,
      headers: admin.headers,
      payload: { version: p.version, price: '130.00' },
    });
    await toReady(o.id);
    const done = await ok<OrderView>(
      await post(`/orders/${o.id}/collect`, {
        idempotencyKey: randomUUID(),
        shiftId: shift.id,
        payments: [cash('100.00')],
      }),
    );
    expect(done.status).toBe('COLLECTED');
    const sale = (
      await ctx.app.inject({ method: 'GET', url: `/sales/${done.saleId}`, headers: admin.headers })
    ).json<SaleView>();
    expect(sale).toMatchObject({
      subtotal: '130.00',
      discountTotal: '30.00',
      total: '100.00',
      paid: '100.00',
    });
  });

  it('a courier settles net of its fee, oldest orders first; a shortfall stays owed', async () => {
    const before = (await courierNow()).balance;
    const customer = await createCustomer(ctx, employee.headers);
    const outs: OrderView[] = [];
    for (const price of ['80.00', '120.00']) {
      const p = await newProduct(1, price);
      const o = await order(customer, [{ itemId: p.items[0]!.id, quantity: 1 }]);
      await toReady(o.id);
      outs.push(
        await ok<OrderView>(await post(`/orders/${o.id}/ship`, { idempotencyKey: randomUUID() })),
      );
    }
    expect((await courierNow()).balance).toBe((Number(before) + 200).toFixed(2));
    const s = await ok<CourierSettlementView>(
      await post(
        `/couriers/${courier.id}/settlements`,
        {
          idempotencyKey: randomUUID(),
          method: 'BANK_TRANSFER',
          received: '170.00',
          fee: '20.00',
          orders: [
            { orderId: outs[0]!.id, amount: '80.00' },
            { orderId: outs[1]!.id, amount: '110.00' },
          ],
        },
        admin.headers,
      ),
    );
    expect(s.orders.map((x) => x.amount)).toEqual(['80.00', '110.00']);
    expect((await courierNow()).balance).toBe((Number(before) + 10).toFixed(2));
    const second = (
      await ctx.app.inject({ method: 'GET', url: `/orders/${outs[1]!.id}`, headers: admin.headers })
    ).json<OrderView>();
    expect(second).toMatchObject({ cod: '120.00', settled: '110.00' });
    // Never more than the order's cash on delivery.
    const over = await post(
      `/couriers/${courier.id}/settlements`,
      {
        idempotencyKey: randomUUID(),
        method: 'BANK_TRANSFER',
        received: '50.00',
        orders: [{ orderId: outs[1]!.id, amount: '50.00' }],
      },
      admin.headers,
    );
    expect(over.json<{ code: string }>().code, over.body).toBe('COURIER_OVER_SETTLED');
    // Employees do not settle with couriers.
    const denied = await post(`/couriers/${courier.id}/settlements`, {
      idempotencyKey: randomUUID(),
      method: 'BANK_TRANSFER',
      received: '10.00',
    });
    expect(denied.statusCode).toBe(403);
  });

  it('a refused parcel: stock back (shelf or damaged), the courier owes nothing, the deposit becomes credit', async () => {
    const p = await newProduct(2, '100.00');
    const itemId = p.items[0]!.id;
    const customer = await createCustomer(ctx, employee.headers);
    const o = await order(customer, [{ itemId, quantity: 2 }]);
    await ok(
      await post(`/orders/${o.id}/deposits`, {
        idempotencyKey: randomUUID(),
        shiftId: shift.id,
        payment: cash('50.00'),
      }),
    );
    await toReady(o.id);
    const owedBefore = (await courierNow()).balance;
    const out = await ok<OrderView>(
      await post(`/orders/${o.id}/ship`, { idempotencyKey: randomUUID() }),
    );
    expect(out.cod).toBe('150.00');
    expect((await courierNow()).balance).toBe((Number(owedBefore) + 150).toFixed(2));
    const back = await ok<OrderView>(
      await post(`/orders/${o.id}/returned`, {
        idempotencyKey: randomUUID(),
        reason: 'رفضت الزبونة الطرد',
        lines: [{ lineId: out.lines[0]!.id, condition: 'SHELF' }],
      }),
    );
    expect(back.status).toBe('RETURNED');
    expect(await balance(itemId)).toMatchObject({ onHand: 2, reserved: 0 });
    expect((await courierNow()).balance).toBe(owedBefore);
    const c = (
      await ctx.app.inject({
        method: 'GET',
        url: `/customers/${customer.id}`,
        headers: admin.headers,
      })
    ).json<CustomerView>();
    expect(c).toMatchObject({ debt: '0.00', credit: '50.00' });
  });

  it('cancelling releases the reservation; a finished order and its history never change', async () => {
    const p = await newProduct(2);
    const itemId = p.items[0]!.id;
    const customer = await createCustomer(ctx, employee.headers);
    const o = await order(customer, [{ itemId, quantity: 2 }]);
    await ok(await post(`/orders/${o.id}/confirm`));
    expect((await balance(itemId)).reserved).toBe(2);
    const cancelled = await ok<OrderView>(
      await post(`/orders/${o.id}/cancel`, { reason: 'غيرت رأيها' }),
    );
    expect(cancelled).toMatchObject({ status: 'CANCELLED', cancelReason: 'غيرت رأيها' });
    expect((await balance(itemId)).reserved).toBe(0);
    await expectDbError(
      ctx.db.update(orders).set({ status: 'NEW' }).where(eq(orders.id, o.id)),
      /cannot move/,
    );
    await expectDbError(
      ctx.db.delete(orderEvents).where(eq(orderEvents.orderId, o.id)),
      /append-only|forbidden|not allowed/i,
    );
  });

  it('the same customer, items and day is flagged as a possible duplicate', async () => {
    const p = await newProduct(5);
    const customer = await createCustomer(ctx, employee.headers);
    const lines = [{ itemId: p.items[0]!.id, quantity: 1 }];
    await order(customer, lines);
    const again = await post('/orders', {
      idempotencyKey: randomUUID(),
      customerId: customer.id,
      lines,
    });
    expect(again.json<{ code: string }>().code).toBe('POSSIBLE_DUPLICATE');
    const anyway = await post('/orders', {
      idempotencyKey: randomUUID(),
      customerId: customer.id,
      lines,
      confirmDuplicate: true,
    });
    expect(anyway.statusCode).toBe(201);
  });

  it('the ledger balances and the courier account equals what its open orders lack', async () => {
    const [{ total } = { total: '1' }] = await ctx.db.execute<{ total: string }>(
      sql`select coalesce(sum(amount),0)::text as total from journal_lines`,
    );
    expect(Number(total)).toBe(0);
    const owed = (await courierNow()).balance;
    const [{ lacking } = { lacking: '0' }] = await ctx.db.execute<{ lacking: string }>(
      sql`select coalesce(sum(o.cod - coalesce((select sum(l.amount) from courier_settlement_lines l where l.order_id = o.id),0)),0)::text as lacking
        from orders o where o.courier_id = ${courier.id} and o.status = 'OUT'`,
    );
    expect(Number(owed)).toBe(Number(lacking));
  });
});
