import { randomUUID } from 'node:crypto';
import type { PaymentReceipt, SaleView, ShiftView, StatementRow } from '@organza/shared';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  itemBalances,
  journalEntries,
  journalLines,
  payments,
  sales,
} from '../src/database/schema/index.js';
import { LedgerService } from '../src/modules/ledger/services/ledger.service.js';
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

describe('sales, payments and shifts', () => {
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
  const line = (itemId: string, quantity = 1, unitPrice = '100.00', discount?: string) => ({
    itemId,
    quantity,
    unitPrice,
    ...(discount ? { discount } : {}),
  });
  const balanceOf = async (itemId: string) =>
    (await ctx.db.select().from(itemBalances).where(eq(itemBalances.itemId, itemId)))[0]!;
  const saleLedger = async (saleId: string, account: string) => {
    const [row] = await ctx.db
      .select({ total: sql<string>`coalesce(sum(${journalLines.amount}),0)::text` })
      .from(journalLines)
      .where(and(eq(journalLines.account, account), eq(journalLines.dimension, saleId)));
    return Number(row!.total);
  };
  const getShift = async (headers: Record<string, string>, id: string) =>
    (await ctx.app.inject({ method: 'GET', url: `/shifts/${id}`, headers })).json<ShiftView>();

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await signedIn(ctx, 'ADMIN');
    employee = await signedIn(ctx, 'EMPLOYEE');
    manager = await signedIn(ctx, 'MANAGER');
    ledger = ctx.app.get(LedgerService);
    categoryId = (await createCategory(ctx, admin.headers)).id;
    const register = await createRegister(ctx);
    shift = await openShift(ctx, employee.headers, register.id, [
      { currency: 'ILS', amount: '200.00' },
    ]);
    const usd = await ctx.app.inject({
      method: 'POST',
      url: '/currencies',
      headers: admin.headers,
      payload: { code: 'EUR', rate: '3.700000' },
    });
    if (usd.statusCode !== 201)
      await ctx.app.inject({
        method: 'PUT',
        url: '/currencies/EUR/rate',
        headers: admin.headers,
        payload: { rate: '3.700000' },
      });
  });
  afterAll(() => ctx.close());

  describe('customers', () => {
    it('stores the phone as entered and refuses the same line under the other prefix', async () => {
      const c = await createCustomer(ctx, employee.headers, {
        name: 'سارة',
        phone: '0599 111 222',
      });
      expect(c.phone).toBe('+970599111222');
      const dup = await ctx.app.inject({
        method: 'POST',
        url: '/customers',
        headers: employee.headers,
        payload: { name: 'سارة ٢', phone: '+972599111222' },
      });
      expect(dup.statusCode).toBe(409);
      expect(dup.json<{ code: string; details: { customerId: string } }>()).toMatchObject({
        code: 'PHONE_TAKEN',
        details: { customerId: c.id },
      });
      const found = await ctx.app.inject({
        method: 'GET',
        url: '/customers?q=599111',
        headers: employee.headers,
      });
      expect(found.json<{ items: { id: string }[] }>().items.map((i) => i.id)).toContain(c.id);
    });

    it('refuses a phone that is not a number', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/customers',
        headers: employee.headers,
        payload: { name: 'x', phone: '12' },
      });
      expect(res.json<{ code: string }>().code).toBe('PHONE_INVALID');
    });
  });

  describe('checkout', () => {
    it('sells for cash with change; revenue, cash and cost of goods all post and balance', async () => {
      const itemId = await newItem(3);
      const sale = await sell(ctx, employee.headers, {
        shiftId: shift.id,
        lines: [line(itemId, 2)],
        payments: [cash('250.00')],
      });
      expect(sale).toMatchObject({
        total: '200.00',
        paid: '200.00',
        owed: '0.00',
        change: '50.00',
        paymentState: 'PAID',
      });
      expect((await balanceOf(itemId)).onHand).toBe(1);
      expect(await saleLedger(sale.id, 'CUSTOMER_RECEIVABLES')).toBe(0);
      const entries = await ledger.entriesFor(ctx.db, 'sale', sale.id);
      expect(entries.map((e) => e.event).sort()).toEqual(['SALE', 'SALE_COMPLETED']);
      const cogs = await ctx.db
        .select({ total: sql<string>`sum(${journalLines.amount})::text` })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
        .where(and(eq(journalEntries.sourceId, sale.id), eq(journalLines.account, 'COGS')));
      expect(cogs[0]!.total).toBe('80.00');
    });

    it('takes a foreign currency at the current rate and records currency, amount and rate', async () => {
      const itemId = await newItem(1, '370.00');
      const sale = await sell(ctx, employee.headers, {
        shiftId: shift.id,
        lines: [line(itemId, 1, '370.00')],
        payments: [{ method: 'CASH', currency: 'EUR', amount: '100.00', rate: '3.700000' }],
      });
      expect(sale.payments[0]).toMatchObject({
        currency: 'EUR',
        amount: '100.00',
        amountDefault: '370.00',
      });
      const stale = await checkout(ctx, employee.headers, {
        shiftId: shift.id,
        lines: [line(await newItem(1), 1)],
        payments: [{ method: 'CASH', currency: 'EUR', amount: '30.00', rate: '3.500000' }],
      });
      expect(stale.json<{ code: string }>().code).toBe('RATE_CHANGED');
    });

    it('refuses unpaid sales without a customer and sells on debt with one', async () => {
      const itemId = await newItem(2);
      const anonymous = await checkout(ctx, employee.headers, {
        shiftId: shift.id,
        lines: [line(itemId)],
        payments: [cash('30.00')],
      });
      expect(anonymous.json<{ code: string }>().code).toBe('CUSTOMER_REQUIRED');
      const customer = await createCustomer(ctx, employee.headers);
      const sale = await sell(ctx, employee.headers, {
        shiftId: shift.id,
        customerId: customer.id,
        lines: [line(itemId)],
        payments: [cash('30.00')],
      });
      expect(sale).toMatchObject({ paid: '30.00', owed: '70.00', paymentState: 'PARTLY_PAID' });
      const after = (
        await ctx.app.inject({
          method: 'GET',
          url: `/customers/${customer.id}`,
          headers: employee.headers,
        })
      ).json<{ debt: string }>();
      expect(after.debt).toBe('70.00');
    });

    it('refuses a changed price and shows the new one', async () => {
      const itemId = await newItem(1, '120.00');
      const res = await checkout(ctx, employee.headers, {
        shiftId: shift.id,
        lines: [line(itemId, 1, '100.00')],
        payments: [cash('100.00')],
      });
      expect(res.statusCode).toBe(409);
      expect(res.json<{ code: string; details: { items: unknown[] } }>()).toMatchObject({
        code: 'PRICE_CHANGED',
        details: { items: [{ itemId, price: '120.00' }] },
      });
    });

    it('spreads a cart discount and asks a manager above the employee limit', async () => {
      const a = await newItem(5);
      const b = await newItem(5, '50.00');
      const ok = await sell(ctx, employee.headers, {
        shiftId: shift.id,
        lines: [line(a, 1), line(b, 1, '50.00')],
        cartDiscount: '15.00',
        payments: [cash('135.00')],
      });
      expect(ok.lines.map((l) => l.discount)).toEqual(['10.00', '5.00']);
      expect(ok.total).toBe('135.00');
      const big = await checkout(ctx, employee.headers, {
        shiftId: shift.id,
        lines: [line(a, 1, '100.00', '30.00')],
        payments: [cash('70.00')],
      });
      expect(big.json<{ code: string }>().code).toBe('DISCOUNT_NEEDS_MANAGER');
    });

    it('sells the last piece once when two tills check out at the same time', async () => {
      const itemId = await newItem(1);
      const results = await Promise.all(
        [0, 1].map(() =>
          checkout(ctx, employee.headers, {
            shiftId: shift.id,
            lines: [line(itemId)],
            payments: [cash('100.00')],
            confirmDuplicate: true,
          }),
        ),
      );
      const codes = results.map((r) => r.statusCode).sort();
      expect(codes).toEqual([201, 409]);
      expect(results.find((r) => r.statusCode === 409)!.json<{ code: string }>().code).toBe(
        'STOCK_INSUFFICIENT',
      );
      expect((await balanceOf(itemId)).onHand).toBe(0);
    });

    it('replays the same key after a crash: one sale, one payment, one stock movement', async () => {
      const itemId = await newItem(3);
      const payload = {
        idempotencyKey: randomUUID(),
        shiftId: shift.id,
        lines: [line(itemId)],
        payments: [cash('100.00')],
      };
      const [first, second] = await Promise.all([
        ctx.app.inject({ method: 'POST', url: '/sales', headers: employee.headers, payload }),
        ctx.app.inject({ method: 'POST', url: '/sales', headers: employee.headers, payload }),
      ]);
      const again = await ctx.app.inject({
        method: 'POST',
        url: '/sales',
        headers: employee.headers,
        payload,
      });
      const ids = [first, second, again].map((r) => r.json<SaleView>().id);
      expect(new Set(ids).size).toBe(1);
      expect(again.json<SaleView>().replayed).toBe(true);
      expect((await balanceOf(itemId)).onHand).toBe(2);
      const pays = await ctx.db.select().from(payments).where(eq(payments.saleId, ids[0]!));
      expect(pays).toHaveLength(1);
    });

    it('warns when the same cart is sold twice within a minute under a new key', async () => {
      const itemId = await newItem(3);
      await sell(ctx, employee.headers, {
        shiftId: shift.id,
        lines: [line(itemId, 1)],
        payments: [cash('100.00')],
      });
      const twice = await checkout(ctx, employee.headers, {
        shiftId: shift.id,
        lines: [line(itemId, 1)],
        payments: [cash('100.00')],
      });
      expect(twice.json<{ code: string }>().code).toBe('POSSIBLE_DUPLICATE');
      const confirmed = await checkout(ctx, employee.headers, {
        shiftId: shift.id,
        lines: [line(itemId, 1)],
        payments: [cash('100.00')],
        confirmDuplicate: true,
      });
      expect(confirmed.statusCode).toBe(201);
    });

    it('keeps an over-tender as store credit and lets the customer spend it', async () => {
      const customer = await createCustomer(ctx, employee.headers);
      await sell(ctx, employee.headers, {
        shiftId: shift.id,
        customerId: customer.id,
        lines: [line(await newItem(1))],
        payments: [{ method: 'CARD', currency: 'ILS', amount: '150.00', reference: 'slip 1' }],
        overpayment: 'CREDIT',
      });
      const c1 = (
        await ctx.app.inject({
          method: 'GET',
          url: `/customers/${customer.id}`,
          headers: employee.headers,
        })
      ).json<{ credit: string }>();
      expect(c1.credit).toBe('50.00');
      const sale = await sell(ctx, employee.headers, {
        shiftId: shift.id,
        customerId: customer.id,
        lines: [line(await newItem(1))],
        payments: [{ method: 'STORE_CREDIT', currency: 'ILS', amount: '50.00' }, cash('50.00')],
      });
      expect(sale.paymentState).toBe('PAID');
      const tooMuch = await checkout(ctx, employee.headers, {
        shiftId: shift.id,
        customerId: customer.id,
        lines: [line(await newItem(1))],
        payments: [{ method: 'STORE_CREDIT', currency: 'ILS', amount: '10.00' }],
      });
      expect(tooMuch.json<{ code: string }>().code).toBe('CREDIT_INSUFFICIENT');
    });

    it('refuses over-tendering by card when change is asked for', async () => {
      const res = await checkout(ctx, employee.headers, {
        shiftId: shift.id,
        lines: [line(await newItem(1))],
        payments: [{ method: 'CARD', currency: 'ILS', amount: '120.00' }],
      });
      expect(res.json<{ code: string }>().code).toBe('OVERPAID_NON_CASH');
    });
  });

  describe('debts and repayments', () => {
    it('pays the oldest debt first, then the next, and keeps the rest as credit', async () => {
      const customer = await createCustomer(ctx, employee.headers);
      const first = await sell(ctx, employee.headers, {
        shiftId: shift.id,
        customerId: customer.id,
        lines: [line(await newItem(1))],
      });
      const second = await sell(ctx, employee.headers, {
        shiftId: shift.id,
        customerId: customer.id,
        lines: [line(await newItem(1), 1, '100.00')],
        payments: [cash('40.00')],
      });
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/customers/${customer.id}/payments`,
        headers: employee.headers,
        payload: { idempotencyKey: randomUUID(), shiftId: shift.id, payments: [cash('180.00')] },
      });
      expect(res.statusCode).toBe(201);
      const receipt = res.json<PaymentReceipt>();
      expect(receipt.allocations).toEqual(
        expect.arrayContaining([
          { saleId: first.id, saleNumber: first.number, amount: '100.00' },
          { saleId: second.id, saleNumber: second.number, amount: '60.00' },
        ]),
      );
      expect(receipt.toCredit).toBe('20.00');
      expect(receipt.customer).toMatchObject({ debt: '0.00', credit: '20.00' });
      const statement = (
        await ctx.app.inject({
          method: 'GET',
          url: `/customers/${customer.id}/statement`,
          headers: employee.headers,
        })
      ).json<StatementRow[]>();
      expect(statement.map((r) => r.balance)).toEqual(['100.00', '200.00', '160.00', '-20.00']);
    });

    it('lets the cashier pick which sale a payment is for', async () => {
      const customer = await createCustomer(ctx, employee.headers);
      await sell(ctx, employee.headers, {
        shiftId: shift.id,
        customerId: customer.id,
        lines: [line(await newItem(1))],
      });
      const newer = await sell(ctx, employee.headers, {
        shiftId: shift.id,
        customerId: customer.id,
        lines: [line(await newItem(1))],
      });
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/customers/${customer.id}/payments`,
        headers: employee.headers,
        payload: {
          idempotencyKey: randomUUID(),
          payments: [
            { method: 'BANK_TRANSFER', currency: 'ILS', amount: '100.00', reference: 'TRX-9' },
          ],
          allocations: [{ saleId: newer.id, amount: '100.00' }],
        },
      });
      expect(res.json<PaymentReceipt>().allocations).toEqual([
        { saleId: newer.id, saleNumber: newer.number, amount: '100.00' },
      ]);
    });
  });

  describe('held goods', () => {
    it('reserves, takes a deposit, hands over in parts and asks before handing over owed goods', async () => {
      const customer = await createCustomer(ctx, employee.headers);
      const a = await newItem(2);
      const b = await newItem(2);
      const sale = await sell(ctx, employee.headers, {
        shiftId: shift.id,
        customerId: customer.id,
        mode: 'HELD',
        lines: [line(a), line(b)],
        payments: [cash('150.00')],
      });
      expect(sale).toMatchObject({ fulfilment: 'HELD', paid: '150.00' });
      expect(await balanceOf(a)).toMatchObject({ onHand: 2, reserved: 1 });
      expect(await ledger.entriesFor(ctx.db, 'sale', sale.id)).toHaveLength(0);
      const c = (
        await ctx.app.inject({
          method: 'GET',
          url: `/customers/${customer.id}`,
          headers: employee.headers,
        })
      ).json<{ deposits: string; debt: string }>();
      expect(c).toMatchObject({ deposits: '150.00', debt: '0.00' });

      const firstLine = sale.lines[0]!.id;
      const part = await ctx.app.inject({
        method: 'POST',
        url: `/sales/${sale.id}/handover`,
        headers: employee.headers,
        payload: { idempotencyKey: randomUUID(), lines: [{ lineId: firstLine, quantity: 1 }] },
      });
      expect(part.json<SaleView>().fulfilment).toBe('PARTLY_HANDED');
      expect(await balanceOf(a)).toMatchObject({ onHand: 1, reserved: 0 });

      const rest = await ctx.app.inject({
        method: 'POST',
        url: `/sales/${sale.id}/handover`,
        headers: employee.headers,
        payload: { idempotencyKey: randomUUID() },
      });
      expect(rest.json<{ code: string; details: { owed: string } }>()).toMatchObject({
        code: 'OWED_NOT_ACKNOWLEDGED',
        details: { owed: '50.00' },
      });
      const done = await ctx.app.inject({
        method: 'POST',
        url: `/sales/${sale.id}/handover`,
        headers: employee.headers,
        payload: { idempotencyKey: randomUUID(), acknowledgeOwed: true },
      });
      expect(done.json<SaleView>()).toMatchObject({ fulfilment: 'FULFILLED', owed: '50.00' });
      const after = (
        await ctx.app.inject({
          method: 'GET',
          url: `/customers/${customer.id}`,
          headers: employee.headers,
        })
      ).json<{ deposits: string; debt: string }>();
      expect(after).toMatchObject({ deposits: '0.00', debt: '50.00' });
      const revenue = await ctx.db
        .select({ total: sql<string>`sum(${journalLines.amount})::text` })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
        .where(
          and(eq(journalEntries.sourceId, sale.id), eq(journalLines.account, 'SALES_REVENUE')),
        );
      expect(revenue[0]!.total).toBe('-200.00');
    });

    it('cancels a held sale: refund, credit, or (managers only) keep the deposit', async () => {
      const make = async () => {
        const customer = await createCustomer(ctx, employee.headers);
        const itemId = await newItem(1);
        const sale = await sell(ctx, employee.headers, {
          shiftId: shift.id,
          customerId: customer.id,
          mode: 'HELD',
          lines: [line(itemId)],
          payments: [cash('40.00')],
        });
        return { customer, itemId, sale };
      };
      const cancel = (
        headers: Record<string, string>,
        saleId: string,
        body: Record<string, unknown>,
      ) =>
        ctx.app.inject({
          method: 'POST',
          url: `/sales/${saleId}/cancel-held`,
          headers,
          payload: { idempotencyKey: randomUUID(), reason: 'لم تعد', ...body },
        });

      const refund = await make();
      const r = await cancel(employee.headers, refund.sale.id, {
        outcome: 'REFUND',
        refundMethod: 'CASH',
        shiftId: shift.id,
      });
      expect(r.json<SaleView>()).toMatchObject({ status: 'CANCELLED', paid: '0.00' });
      expect(await balanceOf(refund.itemId)).toMatchObject({ onHand: 1, reserved: 0 });

      const toCredit = await make();
      await cancel(employee.headers, toCredit.sale.id, { outcome: 'CREDIT' });
      const c = (
        await ctx.app.inject({
          method: 'GET',
          url: `/customers/${toCredit.customer.id}`,
          headers: employee.headers,
        })
      ).json<{ credit: string; deposits: string }>();
      expect(c).toMatchObject({ credit: '40.00', deposits: '0.00' });

      const keep = await make();
      const refused = await cancel(employee.headers, keep.sale.id, { outcome: 'KEEP_DEPOSIT' });
      expect(refused.json<{ code: string }>().code).toBe('KEEP_DEPOSIT_NEEDS_MANAGER');
      const kept = await cancel(manager.headers, keep.sale.id, { outcome: 'KEEP_DEPOSIT' });
      expect(kept.json<SaleView>()).toMatchObject({
        status: 'CANCELLED',
        cancelOutcome: 'KEEP_DEPOSIT',
      });
      expect(
        (
          await ctx.app.inject({
            method: 'GET',
            url: `/customers/${keep.customer.id}`,
            headers: employee.headers,
          })
        ).json<{ deposits: string }>().deposits,
      ).toBe('0.00');
    });
  });

  describe('shift close', () => {
    it('never shows the expected cash before the blind count, then reconciles line by line', async () => {
      const register = await createRegister(ctx);
      const own = await openShift(ctx, employee.headers, register.id, [
        { currency: 'ILS', amount: '100.00' },
      ]);
      await sell(ctx, employee.headers, {
        shiftId: own.id,
        lines: [line(await newItem(1))],
        payments: [cash('150.00')],
      });
      await sell(ctx, employee.headers, {
        shiftId: own.id,
        lines: [line(await newItem(1))],
        payments: [{ method: 'CARD', currency: 'ILS', amount: '100.00' }],
      });
      const expense = await ctx.app.inject({
        method: 'POST',
        url: `/shifts/${own.id}/movements`,
        headers: employee.headers,
        payload: {
          idempotencyKey: randomUUID(),
          type: 'EXPENSE',
          currency: 'ILS',
          amount: '20.00',
          counterpart: 'CLEANING',
          note: 'منظفات',
        },
      });
      expect(expense.statusCode).toBe(201);

      const before = await ctx.app.inject({
        method: 'GET',
        url: `/shifts/${own.id}`,
        headers: employee.headers,
      });
      const body = before.json<ShiftView>();
      expect(body.reconciliation).toBeNull();
      expect(body.totals.salesTotal).toBeNull();
      expect(body.totals.byMethod.map((m) => m.method)).toEqual(['CARD']);
      expect(before.body).not.toContain('180.00');

      const counted = await ctx.app.inject({
        method: 'POST',
        url: `/shifts/${own.id}/count`,
        headers: employee.headers,
        payload: {
          counts: [
            {
              currency: 'ILS',
              amount: '175.00',
              denominations: { '100': 1, '50': 1, '20': 1, '5': 1 },
            },
          ],
        },
      });
      const rec = counted.json<ShiftView>().reconciliation!;
      // 100 float + 150 cash sale − 50 change − 20 expense = 180 expected; 175 counted.
      expect(rec).toEqual([
        expect.objectContaining({
          currency: 'ILS',
          expected: '180.00',
          counted: '175.00',
          difference: '-5.00',
        }),
      ]);
      expect(rec[0]!.lines.map((l) => [l.kind, l.amount])).toEqual(
        expect.arrayContaining([
          ['OPENING_FLOAT', '100.00'],
          ['CASH_SALES', '150.00'],
          ['CHANGE_GIVEN', '50.00'],
          ['EXPENSES', '20.00'],
        ]),
      );
      const again = await ctx.app.inject({
        method: 'POST',
        url: `/shifts/${own.id}/count`,
        headers: employee.headers,
        payload: { counts: [{ currency: 'ILS', amount: '180.00' }] },
      });
      expect(again.statusCode).toBe(409);

      const noNote = await ctx.app.inject({
        method: 'POST',
        url: `/shifts/${own.id}/close`,
        headers: employee.headers,
        payload: { drops: [{ currency: 'ILS', amount: '125.00', to: 'SAFE' }] },
      });
      expect(noNote.json<{ code: string }>().code).toBe('NOTE_REQUIRED');
      const closed = await ctx.app.inject({
        method: 'POST',
        url: `/shifts/${own.id}/close`,
        headers: employee.headers,
        payload: { drops: [{ currency: 'ILS', amount: '125.00', to: 'SAFE' }], note: 'نقص ٥' },
      });
      expect(closed.json<ShiftView>()).toMatchObject({ status: 'CLOSED', hasDifference: true });
      const shortage = await ledger.entriesFor(ctx.db, 'shift', own.id);
      expect(shortage.map((e) => e.event)).toContain('DRAWER_DIFFERENCE');

      // The next shift expects the 50 left behind.
      const next = await ctx.app.inject({
        method: 'POST',
        url: '/shifts',
        headers: employee.headers,
        payload: { registerId: register.id, float: [{ currency: 'ILS', amount: '40.00' }] },
      });
      expect(next.json<{ code: string }>().code).toBe('NOTE_REQUIRED');
      const ok = await openShift(ctx, employee.headers, register.id, [
        { currency: 'ILS', amount: '50.00' },
      ]);
      expect(ok.status).toBe('OPEN');

      const signed = await ctx.app.inject({
        method: 'POST',
        url: `/shifts/${own.id}/sign-off`,
        headers: manager.headers,
        payload: { note: 'تمت المراجعة' },
      });
      expect(signed.json<ShiftView>().signedOffAt).not.toBeNull();
    });

    it('refuses sales on a counted shift and allows one open shift per till', async () => {
      const register = await createRegister(ctx);
      const own = await openShift(ctx, employee.headers, register.id, []);
      const second = await ctx.app.inject({
        method: 'POST',
        url: '/shifts',
        headers: manager.headers,
        payload: { registerId: register.id, float: [] },
      });
      expect(second.json<{ code: string }>().code).toBe('SHIFT_ALREADY_OPEN');
      await ctx.app.inject({
        method: 'POST',
        url: `/shifts/${own.id}/count`,
        headers: employee.headers,
        payload: { counts: [{ currency: 'ILS', amount: '0.00' }] },
      });
      const res = await checkout(ctx, employee.headers, {
        shiftId: own.id,
        lines: [line(await newItem(1))],
        payments: [cash('100.00')],
      });
      expect(res.json<{ code: string }>().code).toBe('SHIFT_NOT_OPEN');
    });

    it("hides another cashier's closed shift from employees", async () => {
      const other = await signedIn(ctx, 'EMPLOYEE');
      const register = await createRegister(ctx);
      const own = await openShift(ctx, employee.headers, register.id, []);
      await ctx.app.inject({
        method: 'POST',
        url: `/shifts/${own.id}/count`,
        headers: employee.headers,
        payload: { counts: [{ currency: 'ILS', amount: '0.00' }] },
      });
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/shifts/${own.id}`,
        headers: other.headers,
      });
      expect(res.statusCode).toBe(403);
      expect((await getShift(manager.headers, own.id)).status).toBe('COUNTED');
    });
  });

  describe('integrity', () => {
    it('keeps every posting balanced and the receivables equal to what customers owe', async () => {
      const trial = await ledger.trialBalance(ctx.db);
      const sum = trial.reduce((s, r) => s + Math.round(Number(r.balance) * 100), 0);
      expect(sum).toBe(0);
      const [owed] = await ctx.db
        .select({
          total: sql<string>`coalesce(sum(s.total - coalesce((select sum(a.amount) from payment_allocations a where a.sale_id = s.id),0)),0)::text`,
        })
        .from(sql`sales s`)
        .where(
          sql`s.status = 'COMPLETED' and s.fulfilment_mode = 'TAKEN' and s.customer_id is not null`,
        );
      const [receivable] = await ctx.db
        .select({ total: sql<string>`coalesce(sum(amount),0)::text` })
        .from(journalLines)
        .where(
          and(
            eq(journalLines.account, 'CUSTOMER_RECEIVABLES'),
            eq(journalLines.partyType, 'CUSTOMER'),
          ),
        );
      // Held sales handed over with money owed also sit in receivables.
      const [heldOwed] = await ctx.db
        .select({ total: sql<string>`coalesce(sum(l.amount),0)::text` })
        .from(sql`journal_lines l join sales s on s.id::text = l.dimension`)
        .where(sql`l.account = 'CUSTOMER_RECEIVABLES' and s.fulfilment_mode = 'HELD'`);
      expect(Number(receivable!.total)).toBeCloseTo(
        Number(owed!.total) + Number(heldOwed!.total),
        2,
      );
    });

    it('refuses to edit a payment or delete a sale in the database', async () => {
      const [p] = await ctx.db.select().from(payments).limit(1);
      await expectDbError(
        ctx.db.update(payments).set({ amount: '1.00' }).where(eq(payments.id, p!.id)),
        /ledger/,
      );
      const [s] = await ctx.db.select().from(sales).limit(1);
      await expectDbError(ctx.db.delete(sales).where(eq(sales.id, s!.id)), /delete|archive/i);
      await expectDbError(
        ctx.db.update(sales).set({ total: '1.00' }).where(eq(sales.id, s!.id)),
        /ledger/,
      );
    });
  });
});
