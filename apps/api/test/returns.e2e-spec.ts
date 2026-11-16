import { randomUUID } from 'node:crypto';
import type { CustomerView, ReturnView, SaleView, ShiftView } from '@organza/shared';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { itemBalances, journalLines, saleReturns } from '../src/database/schema/index.js';
import { LedgerService } from '../src/modules/ledger/services/ledger.service.js';
import { StockService } from '../src/modules/stock/services/stock.service.js';
import { createCategory, createProduct } from './helpers/catalogue.js';
import { expectDbError, signedIn } from './helpers/fixtures.js';
import {
  cash,
  checkout,
  createCustomer,
  createRegister,
  openShift,
  sell,
} from './helpers/sales.js';
import { createTestContext, type TestContext } from './helpers/test-app.js';

type Headers = Record<string, string>;

describe('returns, exchanges, voids and giveaways', () => {
  let ctx: TestContext;
  let admin: Awaited<ReturnType<typeof signedIn>>;
  let employee: Awaited<ReturnType<typeof signedIn>>;
  let manager: Awaited<ReturnType<typeof signedIn>>;
  let ledger: LedgerService;
  let categoryId: string;
  let shift: ShiftView;

  const newItem = async (stock = 5, price = '100.00', cost = '40.00') => {
    const p = await createProduct(ctx, admin.headers, {
      type: 'REGULAR',
      name: { ar: `فستان ${randomUUID().slice(0, 4)}` },
      categoryId,
      stock,
      price,
      cost,
    });
    return p.items[0]!.id;
  };
  const line = (itemId: string, quantity = 1, unitPrice = '100.00', extra = {}) => ({
    itemId,
    quantity,
    unitPrice,
    ...extra,
  });
  const balanceOf = async (itemId: string) =>
    (await ctx.db.select().from(itemBalances).where(eq(itemBalances.itemId, itemId)))[0]!;
  const accountTotal = async (account: string) =>
    Number(await ledger.balance(ctx.db, account as never));
  const postReturn = (headers: Headers, payload: Record<string, unknown>) =>
    ctx.app.inject({
      method: 'POST',
      url: '/sales/returns',
      headers,
      payload: { idempotencyKey: randomUUID(), shiftId: shift.id, reason: 'لا يناسب', ...payload },
    });
  const returned = async (headers: Headers, payload: Record<string, unknown>) => {
    const res = await postReturn(headers, payload);
    if (res.statusCode !== 201) throw new Error(`return ${res.statusCode} ${res.body}`);
    return res.json<ReturnView>();
  };
  const getSale = async (id: string) =>
    (
      await ctx.app.inject({ method: 'GET', url: `/sales/${id}`, headers: admin.headers })
    ).json<SaleView>();
  const getCustomer = async (id: string) =>
    (
      await ctx.app.inject({ method: 'GET', url: `/customers/${id}`, headers: admin.headers })
    ).json<CustomerView>();

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await signedIn(ctx, 'ADMIN');
    employee = await signedIn(ctx, 'EMPLOYEE');
    manager = await signedIn(ctx, 'MANAGER');
    ledger = ctx.app.get(LedgerService);
    categoryId = (await createCategory(ctx, admin.headers)).id;
    const register = await createRegister(ctx);
    shift = await openShift(ctx, employee.headers, register.id);
  });
  afterAll(() => ctx.close());

  it('returns a discounted piece to the shelf and refunds what was paid for it, in cash', async () => {
    const itemId = await newItem(5);
    const sale = await sell(ctx, employee.headers, {
      shiftId: shift.id,
      lines: [line(itemId, 2, '100.00', { discount: '20.00' })],
      payments: [cash('180.00')],
    });
    const revenueBefore = await accountTotal('SALES_REVENUE');
    const r = await returned(employee.headers, {
      saleId: sale.id,
      lines: [{ lineId: sale.lines[0]!.id, quantity: 1 }],
    });
    expect(r).toMatchObject({
      kind: 'RETURN',
      value: '90.00',
      debtReduced: '0.00',
      refunded: '90.00',
      refundMethod: 'CASH',
      toCredit: '0.00',
    });
    expect((await balanceOf(itemId)).onHand).toBe(4);
    // 100 of revenue and 10 of discount come off.
    expect(await accountTotal('SALES_REVENUE')).toBeCloseTo(revenueBefore + 100, 2);
    const after = await getSale(sale.id);
    expect(after).toMatchObject({
      returnedTotal: '90.00',
      paid: '90.00',
      owed: '0.00',
      paymentState: 'PAID',
    });
    expect(after.lines[0]!.returned).toBe(1);
    expect(after.returns.map((x) => x.number)).toEqual([r.number]);
  });

  it('a return on a debt sale only reduces the debt; no money changes hands', async () => {
    const itemId = await newItem(5);
    const customer = await createCustomer(ctx, employee.headers);
    const sale = await sell(ctx, employee.headers, {
      shiftId: shift.id,
      customerId: customer.id,
      lines: [line(itemId, 2)],
      payments: [],
    });
    expect((await getCustomer(customer.id)).debt).toBe('200.00');
    const r = await returned(employee.headers, {
      saleId: sale.id,
      lines: [{ lineId: sale.lines[0]!.id, quantity: 1 }],
    });
    expect(r).toMatchObject({ value: '100.00', debtReduced: '100.00', refunded: '0.00' });
    expect((await getCustomer(customer.id)).debt).toBe('100.00');
    expect(await getSale(sale.id)).toMatchObject({ owed: '100.00', paymentState: 'UNPAID' });
  });

  it('a partly paid sale: the debt is cleared first and the rest becomes store credit', async () => {
    const itemId = await newItem(5);
    const customer = await createCustomer(ctx, employee.headers);
    const sale = await sell(ctx, employee.headers, {
      shiftId: shift.id,
      customerId: customer.id,
      lines: [line(itemId, 2)],
      payments: [cash('150.00')],
    });
    const r = await returned(employee.headers, {
      saleId: sale.id,
      settlement: 'CREDIT',
      lines: [{ lineId: sale.lines[0]!.id, quantity: 1 }],
    });
    expect(r).toMatchObject({ debtReduced: '50.00', toCredit: '50.00', refunded: '0.00' });
    expect(await getCustomer(customer.id)).toMatchObject({ debt: '0.00', credit: '50.00' });
    expect(await getSale(sale.id)).toMatchObject({ paid: '100.00', owed: '0.00' });
  });

  it('store credit needs a customer', async () => {
    const itemId = await newItem(2);
    const sale = await sell(ctx, employee.headers, {
      shiftId: shift.id,
      lines: [line(itemId)],
      payments: [cash('100.00')],
    });
    const res = await postReturn(employee.headers, {
      saleId: sale.id,
      settlement: 'CREDIT',
      lines: [{ lineId: sale.lines[0]!.id, quantity: 1 }],
    });
    expect(res.json<{ code: string }>().code).toBe('CUSTOMER_REQUIRED');
  });

  it('a damaged return goes to the damaged bucket and its cost becomes a loss', async () => {
    const itemId = await newItem(3, '100.00', '40.00');
    const sale = await sell(ctx, employee.headers, {
      shiftId: shift.id,
      lines: [line(itemId)],
      payments: [cash('100.00')],
    });
    const lossBefore = await accountTotal('DAMAGE_AND_LOSS');
    await returned(employee.headers, {
      saleId: sale.id,
      lines: [{ lineId: sale.lines[0]!.id, quantity: 1, condition: 'DAMAGED' }],
    });
    const b = await balanceOf(itemId);
    expect([b.onHand, b.damaged]).toEqual([2, 1]);
    expect(await accountTotal('DAMAGE_AND_LOSS')).toBeCloseTo(lossBefore + 40, 2);
  });

  it('never takes back more than was sold, even when two returns race', async () => {
    const itemId = await newItem(3);
    const sale = await sell(ctx, employee.headers, {
      shiftId: shift.id,
      lines: [line(itemId)],
      payments: [cash('100.00')],
    });
    const lines = [{ lineId: sale.lines[0]!.id, quantity: 1 }];
    const results = await Promise.all([
      postReturn(employee.headers, { saleId: sale.id, lines }),
      postReturn(employee.headers, { saleId: sale.id, lines }),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.statusCode === 409)!.json<{ code: string }>().code).toBe(
      'RETURN_TOO_MANY',
    );
    expect((await balanceOf(itemId)).onHand).toBe(3);
  });

  it('an exchange for something dearer: the old piece pays first, the customer pays the difference', async () => {
    const oldItem = await newItem(3, '100.00');
    const newOne = await newItem(3, '150.00');
    const sale = await sell(ctx, employee.headers, {
      shiftId: shift.id,
      lines: [line(oldItem)],
      payments: [cash('100.00')],
    });
    const r = await returned(employee.headers, {
      saleId: sale.id,
      lines: [{ lineId: sale.lines[0]!.id, quantity: 1 }],
      exchange: { lines: [line(newOne, 1, '150.00')], payments: [cash('50.00')] },
    });
    expect(r).toMatchObject({
      kind: 'EXCHANGE',
      value: '100.00',
      toExchange: '100.00',
      refunded: '0.00',
    });
    const created = await getSale(r.exchangeSale!.id);
    expect(created).toMatchObject({ total: '150.00', paid: '150.00', owed: '0.00' });
    expect(created.exchangeOf).toMatchObject({ saleId: sale.id });
    expect(await getSale(sale.id)).toMatchObject({
      returnedTotal: '100.00',
      paid: '0.00',
      owed: '0.00',
    });
    expect((await balanceOf(oldItem)).onHand).toBe(3);
    expect((await balanceOf(newOne)).onHand).toBe(2);
  });

  it('an exchange for something cheaper refunds the difference', async () => {
    const oldItem = await newItem(3, '100.00');
    const cheaper = await newItem(3, '60.00');
    const sale = await sell(ctx, employee.headers, {
      shiftId: shift.id,
      lines: [line(oldItem)],
      payments: [cash('100.00')],
    });
    const r = await returned(employee.headers, {
      saleId: sale.id,
      lines: [{ lineId: sale.lines[0]!.id, quantity: 1 }],
      exchange: { lines: [line(cheaper, 1, '60.00')] },
    });
    expect(r).toMatchObject({ toExchange: '60.00', refunded: '40.00', refundMethod: 'CASH' });
    expect(await getSale(r.exchangeSale!.id)).toMatchObject({ paid: '60.00', owed: '0.00' });
  });

  it('a cash refund above the limit needs a manager', async () => {
    const itemId = await newItem(5, '150.00');
    const sale = await sell(ctx, employee.headers, {
      shiftId: shift.id,
      lines: [line(itemId, 2, '150.00')],
      payments: [cash('300.00')],
    });
    const lines = [{ lineId: sale.lines[0]!.id, quantity: 2 }];
    const refused = await postReturn(employee.headers, { saleId: sale.id, lines });
    expect(refused.statusCode).toBe(403);
    expect(refused.json<{ code: string }>().code).toBe('REFUND_NEEDS_MANAGER');
    // Nothing happened.
    expect((await getSale(sale.id)).returnedTotal).toBe('0.00');
    const ok = await postReturn(manager.headers, { saleId: sale.id, lines });
    expect(ok.statusCode).toBe(201);
  });

  it('a manager voids a sale: everything back on the shelf, the money refunded, the sale marked void', async () => {
    const itemId = await newItem(4);
    const sale = await sell(ctx, employee.headers, {
      shiftId: shift.id,
      lines: [line(itemId, 2)],
      payments: [cash('200.00')],
    });
    await returned(employee.headers, {
      saleId: sale.id,
      lines: [{ lineId: sale.lines[0]!.id, quantity: 1 }],
    });
    const body = { idempotencyKey: randomUUID(), shiftId: shift.id, reason: 'خطأ في البيع' };
    const byEmployee = await ctx.app.inject({
      method: 'POST',
      url: `/sales/${sale.id}/void`,
      headers: employee.headers,
      payload: body,
    });
    expect(byEmployee.statusCode).toBe(403);
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/sales/${sale.id}/void`,
      headers: manager.headers,
      payload: body,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<ReturnView>()).toMatchObject({
      kind: 'VOID',
      value: '100.00',
      refunded: '100.00',
    });
    expect(await getSale(sale.id)).toMatchObject({
      status: 'VOIDED',
      returnedTotal: '200.00',
      paid: '0.00',
      owed: '0.00',
    });
    expect((await balanceOf(itemId)).onHand).toBe(4);
    const again = await ctx.app.inject({
      method: 'POST',
      url: `/sales/${sale.id}/void`,
      headers: manager.headers,
      payload: { ...body, idempotencyKey: randomUUID() },
    });
    expect(again.json<{ code: string }>().code).toBe('SALE_NOT_RETURNABLE');
  });

  it('goods still held cannot be returned; the held sale is cancelled instead', async () => {
    const itemId = await newItem(2);
    const customer = await createCustomer(ctx, employee.headers);
    const sale = await sell(ctx, employee.headers, {
      shiftId: shift.id,
      customerId: customer.id,
      mode: 'HELD',
      lines: [line(itemId)],
      payments: [],
    });
    const res = await postReturn(employee.headers, {
      saleId: sale.id,
      lines: [{ lineId: sale.lines[0]!.id, quantity: 1 }],
    });
    expect(res.json<{ code: string }>().code).toBe('SALE_NOT_RETURNABLE');
  });

  it('giveaways: managers only, free on the sale, cost booked as promotion and reversed on return', async () => {
    const gift = await newItem(3, '50.00', '20.00');
    const sold = await newItem(3, '100.00');
    const payload = {
      shiftId: shift.id,
      lines: [line(sold), line(gift, 1, '50.00', { giveaway: true })],
      payments: [cash('100.00')],
    };
    const refused = await checkout(ctx, employee.headers, payload);
    expect(refused.json<{ code: string }>().code).toBe('GIVEAWAY_NEEDS_MANAGER');
    const promoBefore = await accountTotal('PROMOTIONS');
    const sale = await sell(ctx, manager.headers, { ...payload, giftReceipt: true });
    expect(sale).toMatchObject({ total: '100.00', giftReceipt: true });
    const giftLine = sale.lines.find((l) => l.giveaway)!;
    expect(giftLine).toMatchObject({ unitPrice: '0.00', lineTotal: '0.00' });
    expect(await accountTotal('PROMOTIONS')).toBeCloseTo(promoBefore + 20, 2);
    const r = await returned(employee.headers, {
      saleId: sale.id,
      lines: [{ lineId: giftLine.id, quantity: 1 }],
    });
    expect(r).toMatchObject({ value: '0.00', refunded: '0.00' });
    expect(await accountTotal('PROMOTIONS')).toBeCloseTo(promoBefore, 2);
    expect((await balanceOf(gift)).onHand).toBe(3);
  });

  it('keeps the books, the stock and the documents intact', async () => {
    const trial = await ledger.trialBalance(ctx.db);
    expect(trial.reduce((s, r) => s + Math.round(Number(r.balance) * 100), 0)).toBe(0);
    expect(await ctx.app.get(StockService).verify(ctx.db)).toEqual([]);
    // What customers owe in the ledger equals what this file's sales say is owed.
    const mine = sql`s.created_by in (${employee.user.id}, ${manager.user.id})`;
    const [owed] = await ctx.db
      .select({
        total: sql<string>`coalesce(sum(s.total - s.returned_total - coalesce((select sum(a.amount) from payment_allocations a where a.sale_id = s.id),0)),0)::text`,
      })
      .from(sql`sales s`)
      .where(
        sql`s.status = 'COMPLETED' and s.fulfilment_mode = 'TAKEN' and s.customer_id is not null and ${mine}`,
      );
    const [receivable] = await ctx.db
      .select({ total: sql<string>`coalesce(sum(amount),0)::text` })
      .from(journalLines)
      .where(
        and(
          eq(journalLines.account, 'CUSTOMER_RECEIVABLES'),
          eq(journalLines.partyType, 'CUSTOMER'),
          sql`${journalLines.dimension} in (select s.id::text from sales s where ${mine})`,
        ),
      );
    expect(Number(receivable!.total)).toBeCloseTo(Number(owed!.total), 2);
    const [any] = await ctx.db.select().from(saleReturns).limit(1);
    await expectDbError(
      ctx.db.update(saleReturns).set({ reason: 'x' }).where(eq(saleReturns.id, any!.id)),
      /append-only|may not/i,
    );
  });
});
