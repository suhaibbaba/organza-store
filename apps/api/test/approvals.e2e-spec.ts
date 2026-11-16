import { randomUUID } from 'node:crypto';
import type {
  ApprovalView,
  Page,
  ProductView,
  ReturnView,
  SaleView,
  ShiftView,
} from '@organza/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { approvalRequests, itemBalances } from '../src/database/schema/index.js';
import { createCategory, createProduct } from './helpers/catalogue.js';
import { expectDbError, signedIn } from './helpers/fixtures.js';
import { cash, createRegister, openShift, sell } from './helpers/sales.js';
import { createTestContext, type TestContext } from './helpers/test-app.js';

type Headers = Record<string, string>;

describe('approvals inbox', () => {
  let ctx: TestContext;
  let admin: Awaited<ReturnType<typeof signedIn>>;
  let employee: Awaited<ReturnType<typeof signedIn>>;
  let manager: Awaited<ReturnType<typeof signedIn>>;
  let categoryId: string;
  let shift: ShiftView;

  const newProduct = async (stock = 5, price = '100.00') =>
    createProduct(ctx, admin.headers, {
      type: 'REGULAR',
      name: { ar: `فستان ${randomUUID().slice(0, 4)}` },
      categoryId,
      stock,
      price,
      cost: '40.00',
    });
  const ask = (headers: Headers, payload: Record<string, unknown>) =>
    ctx.app.inject({ method: 'POST', url: '/approvals', headers, payload });
  const asked = async (headers: Headers, payload: Record<string, unknown>) => {
    const res = await ask(headers, payload);
    if (res.statusCode !== 201) throw new Error(`ask ${res.statusCode} ${res.body}`);
    return res.json<ApprovalView>();
  };
  const decide = (headers: Headers, id: string, action: string, payload = {}) =>
    ctx.app.inject({ method: 'POST', url: `/approvals/${id}/${action}`, headers, payload });
  const product = async (id: string) =>
    (
      await ctx.app.inject({ method: 'GET', url: `/products/${id}`, headers: admin.headers })
    ).json<ProductView>();

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await signedIn(ctx, 'ADMIN');
    employee = await signedIn(ctx, 'EMPLOYEE');
    manager = await signedIn(ctx, 'MANAGER');
    categoryId = (await createCategory(ctx, admin.headers)).id;
    shift = await openShift(ctx, employee.headers, (await createRegister(ctx)).id, [
      { currency: 'ILS', amount: '1000.00' },
    ]);
  });
  afterAll(() => ctx.close());

  it('a price change: the employee asks, a manager approves, the price changes', async () => {
    const p = await newProduct();
    const direct = await ctx.app.inject({
      method: 'PATCH',
      url: `/products/${p.id}`,
      headers: employee.headers,
      payload: { version: p.version, price: '120.00' },
    });
    expect(direct.statusCode).toBe(403);
    const req = await asked(employee.headers, {
      kind: 'PRICE_CHANGE',
      target: 'product',
      id: p.id,
      price: '120.00',
      reason: 'السعر الجديد من المورد',
    });
    expect(req).toMatchObject({ status: 'PENDING', summary: { from: '100.00', to: '120.00' } });
    // One open request per product.
    const again = await ask(employee.headers, {
      kind: 'PRICE_CHANGE',
      target: 'product',
      id: p.id,
      price: '130.00',
      reason: 'مرة ثانية',
    });
    expect(again.json<{ code: string }>().code).toBe('APPROVAL_ALREADY_PENDING');
    // Employees cannot decide; the manager sees it waiting.
    expect((await decide(employee.headers, req.id, 'approve')).statusCode).toBe(403);
    const inbox = await ctx.app.inject({
      method: 'GET',
      url: '/approvals?status=PENDING',
      headers: manager.headers,
    });
    const list = inbox.json<Page<ApprovalView> & { pending: number }>();
    expect(list.items.map((i) => i.id)).toContain(req.id);
    expect(list.pending).toBeGreaterThan(0);
    const ok = await decide(manager.headers, req.id, 'approve', { note: 'موافق' });
    expect(ok.statusCode).toBe(201);
    expect(ok.json<ApprovalView>()).toMatchObject({
      status: 'APPROVED',
      decidedBy: { id: manager.user.id },
    });
    expect((await product(p.id)).price).toBe('120.00');
    expect((await decide(manager.headers, req.id, 'approve')).json<{ code: string }>().code).toBe(
      'APPROVAL_NOT_PENDING',
    );
  });

  it('a stale price change is refused and stays waiting; a rejection closes it', async () => {
    const p = await newProduct();
    const req = await asked(employee.headers, {
      kind: 'PRICE_CHANGE',
      target: 'product',
      id: p.id,
      price: '90.00',
      reason: 'تخفيض',
    });
    await ctx.app.inject({
      method: 'PATCH',
      url: `/products/${p.id}`,
      headers: admin.headers,
      payload: { version: p.version, price: '110.00' },
    });
    const stale = await decide(manager.headers, req.id, 'approve');
    expect(stale.json<{ code: string }>().code).toBe('APPROVAL_STALE');
    expect((await product(p.id)).price).toBe('110.00');
    const rejected = await decide(manager.headers, req.id, 'reject', { note: 'السعر تغير' });
    expect(rejected.json<ApprovalView>()).toMatchObject({
      status: 'REJECTED',
      decisionNote: 'السعر تغير',
    });
  });

  it('nobody approves their own request', async () => {
    const p = await newProduct();
    const req = await asked(manager.headers, {
      kind: 'PRODUCT_HIDE',
      productId: p.id,
      status: 'HIDDEN',
      reason: 'نفد من السوق',
    });
    expect((await decide(manager.headers, req.id, 'approve')).json<{ code: string }>().code).toBe(
      'APPROVAL_OWN_REQUEST',
    );
    expect((await decide(admin.headers, req.id, 'approve')).statusCode).toBe(201);
    expect((await product(p.id)).status).toBe('HIDDEN');
  });

  it('a counted stock correction is approved as the difference it meant, even after a sale', async () => {
    const p = await newProduct(5);
    const itemId = p.items[0]!.id;
    const req = await asked(employee.headers, {
      kind: 'STOCK_ADJUSTMENT',
      reason: 'جرد الرف',
      adjustment: {
        idempotencyKey: randomUUID(),
        reason: 'COUNT_ADJUSTMENT',
        lines: [{ itemId, counted: 3 }],
      },
    });
    expect(req.summary).toMatchObject({ lines: [{ itemId, delta: -2 }] });
    await sell(ctx, employee.headers, {
      shiftId: shift.id,
      lines: [{ itemId, quantity: 1, unitPrice: '100.00' }],
      payments: [cash('100.00')],
    });
    const ok = await decide(manager.headers, req.id, 'approve');
    expect(ok.statusCode).toBe(201);
    expect(ok.json<ApprovalView>().resultId).toBeTruthy();
    const [b] = await ctx.db.select().from(itemBalances).where(eq(itemBalances.itemId, itemId));
    expect(b!.onHand).toBe(2);
  });

  it('a large refund waits for a manager and then pays out exactly as entered', async () => {
    const p = await newProduct(5, '150.00');
    const sale = await sell(ctx, employee.headers, {
      shiftId: shift.id,
      lines: [{ itemId: p.items[0]!.id, quantity: 2, unitPrice: '150.00' }],
      payments: [cash('300.00')],
    });
    const body = {
      idempotencyKey: randomUUID(),
      saleId: sale.id,
      shiftId: shift.id,
      reason: 'القياس غير مناسب',
      lines: [{ lineId: sale.lines[0]!.id, quantity: 2 }],
    };
    const blocked = await ctx.app.inject({
      method: 'POST',
      url: '/sales/returns',
      headers: employee.headers,
      payload: body,
    });
    expect(blocked.json<{ code: string }>().code).toBe('REFUND_NEEDS_MANAGER');
    const req = await asked(employee.headers, {
      kind: 'REFUND',
      reason: 'إرجاع كامل',
      request: body,
    });
    const ok = await decide(manager.headers, req.id, 'approve');
    expect(ok.statusCode).toBe(201);
    const r = (
      await ctx.app.inject({
        method: 'GET',
        url: `/sales/returns/${ok.json<ApprovalView>().resultId}`,
        headers: manager.headers,
      })
    ).json<ReturnView>();
    expect(r).toMatchObject({ refunded: '300.00', approvedBy: manager.user.name });
  });

  it('an employee asks to void a sale; the manager approves it', async () => {
    const p = await newProduct(3);
    const sale = await sell(ctx, employee.headers, {
      shiftId: shift.id,
      lines: [{ itemId: p.items[0]!.id, quantity: 1, unitPrice: '100.00' }],
      payments: [cash('100.00')],
    });
    const req = await asked(employee.headers, {
      kind: 'VOID',
      reason: 'بيع بالخطأ',
      saleId: sale.id,
      request: { idempotencyKey: randomUUID(), shiftId: shift.id, reason: 'بيع بالخطأ' },
    });
    expect((await decide(manager.headers, req.id, 'approve')).statusCode).toBe(201);
    const after = (
      await ctx.app.inject({ method: 'GET', url: `/sales/${sale.id}`, headers: admin.headers })
    ).json<SaleView>();
    expect(after.status).toBe('VOIDED');
  });

  it('only the person who asked can cancel; decided requests never change', async () => {
    const p = await newProduct();
    const req = await asked(employee.headers, {
      kind: 'PRICE_CHANGE',
      target: 'item',
      id: p.items[0]!.id,
      price: '95.00',
      reason: 'سعر خاص',
    });
    expect((await decide(manager.headers, req.id, 'cancel')).json<{ code: string }>().code).toBe(
      'APPROVAL_NOT_YOURS',
    );
    expect((await decide(employee.headers, req.id, 'cancel')).json<ApprovalView>().status).toBe(
      'CANCELLED',
    );
    const mine = await ctx.app.inject({
      method: 'GET',
      url: '/approvals',
      headers: employee.headers,
    });
    expect(
      mine.json<Page<ApprovalView>>().items.every((i) => i.requestedBy.id === employee.user.id),
    ).toBe(true);
    await expectDbError(
      ctx.db
        .update(approvalRequests)
        .set({ status: 'PENDING' })
        .where(eq(approvalRequests.id, req.id)),
      /append-only/,
    );
  });
});
