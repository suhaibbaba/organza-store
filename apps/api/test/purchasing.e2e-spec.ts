import { randomUUID } from 'node:crypto';
import type {
  CreditNoteView,
  PurchaseOrderView,
  ReceiptView,
  ShiftView,
  SupplierPaymentView,
  SupplierStatementRow,
  SupplierView,
} from '@organza/shared';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  itemBalances,
  journalLines,
  payments,
  supplierReceipts,
} from '../src/database/schema/index.js';
import { landLines } from '../src/modules/purchasing/services/purchasing.service.js';
import { createCategory, createProduct } from './helpers/catalogue.js';
import { expectDbError, signedIn } from './helpers/fixtures.js';
import { createRegister, openShift } from './helpers/sales.js';
import { createTestContext, type TestContext } from './helpers/test-app.js';

type Headers = Record<string, string>;

describe('suppliers and purchasing', () => {
  let ctx: TestContext;
  let admin: Awaited<ReturnType<typeof signedIn>>;
  let employee: Awaited<ReturnType<typeof signedIn>>;
  let categoryId: string;
  let shift: ShiftView;

  const call = (method: 'GET' | 'POST', url: string, headers: Headers, payload?: object) =>
    ctx.app.inject({ method, url, headers, ...(payload ? { payload } : {}) });
  const ok = async <T>(res: Awaited<ReturnType<typeof call>>, status = 201) => {
    if (res.statusCode !== status) throw new Error(`${res.statusCode} ${res.body}`);
    return res.json<T>();
  };
  const newItem = async (stock = 0, cost = '40.00') =>
    (
      await createProduct(ctx, admin.headers, {
        type: 'REGULAR',
        name: { ar: `فستان ${randomUUID().slice(0, 4)}` },
        categoryId,
        stock,
        price: '200.00',
        cost,
      })
    ).items[0]!.id;
  const newSupplier = async () =>
    ok<SupplierView>(
      await call('POST', '/suppliers', admin.headers, {
        name: `مورّد ${randomUUID().slice(0, 4)}`,
      }),
    );
  const receive = (payload: object, headers: Headers = admin.headers) =>
    call('POST', '/purchasing/receipts', headers, { idempotencyKey: randomUUID(), ...payload });
  const supplierNow = async (id: string) =>
    ok<SupplierView>(await call('GET', `/suppliers/${id}`, admin.headers), 200);
  const balance = async (itemId: string) =>
    (await ctx.db.select().from(itemBalances).where(eq(itemBalances.itemId, itemId)))[0]!;
  const pay = (supplierId: string, payload: object) =>
    call('POST', `/suppliers/${supplierId}/payments`, admin.headers, {
      idempotencyKey: randomUUID(),
      ...payload,
    });

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await signedIn(ctx, 'ADMIN');
    employee = await signedIn(ctx, 'EMPLOYEE');
    categoryId = (await createCategory(ctx, admin.headers)).id;
    shift = await openShift(ctx, admin.headers, (await createRegister(ctx)).id);
  });
  afterAll(() => ctx.close());

  it('spreads extra costs by value and keeps the money exact', () => {
    const lines = landLines(
      [
        { quantity: 3, unitCost: '10.00' },
        { quantity: 1, unitCost: '70.00' },
      ],
      '10.00',
    );
    // 30 and 70 of value: 3.00 and 7.00 of the extra.
    expect(lines.map((l) => l.lineTotal)).toEqual(['33.00', '77.00']);
    expect(lines.map((l) => l.landedCost)).toEqual(['11.0000', '77.0000']);
    // Free goods share by quantity.
    expect(landLines([{ quantity: 2, unitCost: '0' }], '5.00')[0]!.landedCost).toBe('2.5000');
  });

  it('receiving adds stock at landed cost, moves the average and raises what is owed', async () => {
    const supplier = await newSupplier();
    const itemId = await newItem(2, '40.00');
    const r = await ok<ReceiptView>(
      await receive({
        supplierId: supplier.id,
        supplierRef: 'INV-77',
        lines: [{ itemId, quantity: 2, unitCost: '50.00' }],
        extraCosts: '10.00',
      }),
    );
    expect(r).toMatchObject({ subtotal: '100.00', total: '110.00', paid: '0.00', open: '110.00' });
    expect(r.lines[0]).toMatchObject({ landedCost: '55.0000', lineTotal: '110.00' });
    const b = await balance(itemId);
    expect(b.onHand).toBe(4);
    expect(b.avgCost).toBe('47.5000');
    expect((await supplierNow(supplier.id)).owed).toBe('110.00');
    const [inv] = await ctx.db
      .select({ total: sql<string>`sum(${journalLines.amount})::text` })
      .from(journalLines)
      .where(
        and(
          eq(journalLines.account, 'INVENTORY'),
          sql`${journalLines.entryId} in (select id from journal_entries where source_id = ${r.id})`,
        ),
      );
    expect(Number(inv!.total)).toBe(110);
    const costs = await ok<{ landedCost: string }[]>(
      await call('GET', `/purchasing/items/${itemId}/costs`, admin.headers),
      200,
    );
    expect(costs[0]!.landedCost).toBe('55.0000');
  });

  it('a payment settles the oldest receipt first; paying ahead is used on the next receipt', async () => {
    const supplier = await newSupplier();
    const itemId = await newItem();
    const first = await ok<ReceiptView>(
      await receive({ supplierId: supplier.id, lines: [{ itemId, quantity: 1, unitCost: '100' }] }),
    );
    const second = await ok<ReceiptView>(
      await receive({ supplierId: supplier.id, lines: [{ itemId, quantity: 1, unitCost: '80' }] }),
    );
    const p = await ok<SupplierPaymentView>(
      await pay(supplier.id, {
        payment: { method: 'BANK_TRANSFER', currency: 'ILS', amount: '250.00', reference: 'TR-1' },
      }),
    );
    expect(p.allocations.map((a) => [a.number, a.amount])).toEqual([
      [first.number, '100.00'],
      [second.number, '80.00'],
    ]);
    expect((await supplierNow(supplier.id)).owed).toBe('-70.00');

    const third = await ok<ReceiptView>(
      await receive({ supplierId: supplier.id, lines: [{ itemId, quantity: 1, unitCost: '100' }] }),
    );
    expect(third).toMatchObject({ paid: '70.00', open: '30.00' });
    expect((await supplierNow(supplier.id)).owed).toBe('30.00');

    const statement = await ok<SupplierStatementRow[]>(
      await call('GET', `/suppliers/${supplier.id}/statement`, admin.headers),
      200,
    );
    expect(statement.map((s) => [s.kind, s.balance])).toEqual([
      ['RECEIPT', '100.00'],
      ['RECEIPT', '180.00'],
      ['PAYMENT', '-70.00'],
      ['RECEIPT', '30.00'],
    ]);

    // Listing a receipt that is not open, or more than it lacks, is refused.
    const wrong = await pay(supplier.id, {
      payment: { method: 'BANK_TRANSFER', currency: 'ILS', amount: '50.00' },
      allocations: [{ receiptId: third.id, amount: '40.00' }],
    });
    expect(wrong.json<{ code: string }>().code).toBe('SUPPLIER_ALLOCATION_TOO_LARGE');
  });

  it('cash comes out of the open shift; a refund cannot exceed what was paid ahead', async () => {
    const supplier = await newSupplier();
    const itemId = await newItem();
    const noShift = await receive({
      supplierId: supplier.id,
      lines: [{ itemId, quantity: 1, unitCost: '60' }],
      payment: { method: 'CASH', currency: 'ILS', amount: '60.00' },
    });
    expect(noShift.json<{ code: string }>().code).toBe('SHIFT_REQUIRED');
    const r = await ok<ReceiptView>(
      await receive({
        supplierId: supplier.id,
        lines: [{ itemId, quantity: 1, unitCost: '60' }],
        payment: { method: 'CASH', currency: 'ILS', amount: '60.00' },
        shiftId: shift.id,
      }),
    );
    expect(r).toMatchObject({ paid: '60.00', open: '0.00' });
    const [cashOut] = await ctx.db
      .select()
      .from(payments)
      .where(and(eq(payments.supplierId, supplier.id), eq(payments.shiftId, shift.id)));
    expect(cashOut).toMatchObject({ direction: 'OUT', purpose: 'SUPPLIER_PAYMENT' });

    // Nothing paid ahead: no refund.
    const refused = await pay(supplier.id, {
      direction: 'IN',
      payment: { method: 'SAFE', currency: 'ILS', amount: '5.00' },
    });
    expect(refused.json<{ code: string }>().code).toBe('SUPPLIER_NOTHING_TO_REFUND');
    await ok(
      await pay(supplier.id, { payment: { method: 'SAFE', currency: 'ILS', amount: '20.00' } }),
    );
    await ok(
      await pay(supplier.id, {
        direction: 'IN',
        payment: { method: 'BANK_TRANSFER', currency: 'ILS', amount: '20.00' },
      }),
    );
    expect((await supplierNow(supplier.id)).owed).toBe('0.00');
  });

  it('credit notes: returned goods leave stock, never more than came; an allowance lowers cost', async () => {
    const supplier = await newSupplier();
    const itemId = await newItem();
    const r = await ok<ReceiptView>(
      await receive({ supplierId: supplier.id, lines: [{ itemId, quantity: 3, unitCost: '30' }] }),
    );
    const note = (payload: object) =>
      call('POST', '/purchasing/credit-notes', admin.headers, {
        idempotencyKey: randomUUID(),
        supplierId: supplier.id,
        ...payload,
      });
    const tooMany = await note({
      kind: 'RETURN',
      receiptId: r.id,
      reason: 'faulty seams',
      lines: [{ itemId, quantity: 4, unitCredit: '30' }],
    });
    expect(tooMany.json<{ code: string }>().code).toBe('SUPPLIER_RETURN_TOO_MANY');
    const back = await ok<CreditNoteView>(
      await note({
        kind: 'RETURN',
        receiptId: r.id,
        reason: 'faulty seams',
        lines: [{ itemId, quantity: 1, unitCredit: '30' }],
      }),
    );
    expect(back.amount).toBe('30.00');
    expect((await balance(itemId)).onHand).toBe(2);
    const after = await ok<ReceiptView>(
      await call('GET', `/purchasing/receipts/${r.id}`, admin.headers),
      200,
    );
    expect(after).toMatchObject({ paid: '30.00', open: '60.00' });
    expect(after.lines[0]!.returned).toBe(1);

    await ok(await note({ kind: 'ALLOWANCE', reason: 'late delivery', amount: '10.00' }));
    expect((await supplierNow(supplier.id)).owed).toBe('50.00');
  });

  it('purchase orders: partial deliveries keep it open, the last closes it, cancel needs nothing arrived', async () => {
    const supplier = await newSupplier();
    const a = await newItem();
    const b = await newItem();
    const po = await ok<PurchaseOrderView>(
      await call('POST', '/purchasing/orders', admin.headers, {
        idempotencyKey: randomUUID(),
        supplierId: supplier.id,
        lines: [
          { itemId: a, quantity: 5, unitCost: '20' },
          { itemId: b, quantity: 2, unitCost: '45' },
        ],
      }),
    );
    expect(po).toMatchObject({ status: 'OPEN', total: '190.00' });
    await ok(
      await receive({
        supplierId: supplier.id,
        purchaseOrderId: po.id,
        lines: [{ itemId: a, quantity: 3, unitCost: '20' }],
      }),
    );
    let now = await ok<PurchaseOrderView>(
      await call('GET', `/purchasing/orders/${po.id}`, admin.headers),
      200,
    );
    expect(now.status).toBe('OPEN');
    expect(now.lines.map((l) => l.open)).toEqual([2, 2]);
    const cancel = await call('POST', `/purchasing/orders/${po.id}/close`, admin.headers, {
      outcome: 'CANCELLED',
      reason: 'changed my mind',
    });
    expect(cancel.json<{ code: string }>().code).toBe('PURCHASE_ORDER_HAS_RECEIPTS');
    await ok(
      await receive({
        supplierId: supplier.id,
        purchaseOrderId: po.id,
        lines: [
          { itemId: a, quantity: 2, unitCost: '20' },
          { itemId: b, quantity: 2, unitCost: '45' },
        ],
      }),
    );
    now = await ok<PurchaseOrderView>(
      await call('GET', `/purchasing/orders/${po.id}`, admin.headers),
      200,
    );
    expect(now.status).toBe('CLOSED');
    expect(now.receipts).toHaveLength(2);
    const late = await receive({
      supplierId: supplier.id,
      purchaseOrderId: po.id,
      lines: [{ itemId: a, quantity: 1, unitCost: '20' }],
    });
    expect(late.json<{ code: string }>().code).toBe('PURCHASE_ORDER_NOT_OPEN');
  });

  it('employees receive goods but neither pay suppliers nor see their accounts', async () => {
    const supplier = await newSupplier();
    const itemId = await newItem();
    await ok(
      await receive(
        { supplierId: supplier.id, lines: [{ itemId, quantity: 1, unitCost: '10' }] },
        employee.headers,
      ),
    );
    const paying = await receive(
      {
        supplierId: supplier.id,
        lines: [{ itemId, quantity: 1, unitCost: '10' }],
        payment: { method: 'CASH', currency: 'ILS', amount: '10.00' },
        shiftId: shift.id,
      },
      employee.headers,
    );
    expect(paying.statusCode).toBe(403);
    expect(
      (await call('GET', `/suppliers/${supplier.id}/statement`, employee.headers)).statusCode,
    ).toBe(403);
    expect((await call('GET', '/suppliers', employee.headers)).statusCode).toBe(200);
  });

  it('receipts are append-only', async () => {
    const supplier = await newSupplier();
    const itemId = await newItem();
    const r = await ok<ReceiptView>(
      await receive({ supplierId: supplier.id, lines: [{ itemId, quantity: 1, unitCost: '10' }] }),
    );
    await expectDbError(
      ctx.db.update(supplierReceipts).set({ total: '1.00' }).where(eq(supplierReceipts.id, r.id)),
      /append-only|not allowed|forbid|immutable/i,
    );
  });
});
