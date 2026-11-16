import { randomUUID } from 'node:crypto';
import type {
  ActivityItem,
  CashReport,
  DailySummary,
  DebtsReport,
  InventoryValuation,
  ProfitAndLoss,
  ReceiptView,
  SalesReportRow,
  ShiftView,
  SupplierDebtsReport,
  SupplierView,
  TodayView,
} from '@organza/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCategory, createProduct } from './helpers/catalogue.js';
import { signedIn } from './helpers/fixtures.js';
import { cash, createCustomer, createRegister, openShift, sell } from './helpers/sales.js';
import { createTestContext, type TestContext } from './helpers/test-app.js';

type Headers = Record<string, string>;

describe('reports and dashboard', () => {
  let ctx: TestContext;
  let admin: Awaited<ReturnType<typeof signedIn>>;
  let manager: Awaited<ReturnType<typeof signedIn>>;
  let employee: Awaited<ReturnType<typeof signedIn>>;
  let categoryId: string;
  let shift: ShiftView;
  let today: string;

  const get = async <T>(url: string, headers: Headers = admin.headers) => {
    const res = await ctx.app.inject({ method: 'GET', url, headers });
    if (res.statusCode !== 200) throw new Error(`${res.statusCode} ${res.body}`);
    return res.json<T>();
  };
  const range = () => `from=${today}&to=${today}`;
  const newItem = async (stock = 5, price = '100.00', cost = '40.00') =>
    (
      await createProduct(ctx, admin.headers, {
        type: 'REGULAR',
        name: { ar: `فستان ${randomUUID().slice(0, 4)}` },
        categoryId,
        stock,
        price,
        cost,
      })
    ).items[0]!.id;
  const n = (v: string | null | undefined) => Number(v ?? 0);

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await signedIn(ctx, 'ADMIN');
    manager = await signedIn(ctx, 'MANAGER');
    employee = await signedIn(ctx, 'EMPLOYEE');
    categoryId = (await createCategory(ctx, admin.headers)).id;
    shift = await openShift(ctx, employee.headers, (await createRegister(ctx)).id);
    today = (await get<TodayView>('/dashboard/today')).date;
  });
  afterAll(() => ctx.close());

  it('profit and loss and cash move exactly with a sale and an expense', async () => {
    const pl0 = await get<ProfitAndLoss>(`/reports/profit-and-loss?${range()}`);
    const cash0 = await get<CashReport>(`/reports/cash?${range()}`);
    const itemId = await newItem();
    await sell(ctx, employee.headers, {
      shiftId: shift.id,
      lines: [{ itemId, quantity: 1, unitPrice: '100.00' }],
      payments: [cash('100.00')],
    });
    const expense = await ctx.app.inject({
      method: 'POST',
      url: `/shifts/${shift.id}/movements`,
      headers: employee.headers,
      payload: {
        idempotencyKey: randomUUID(),
        type: 'EXPENSE',
        currency: 'ILS',
        amount: '15.00',
        counterpart: 'CLEANING',
        note: 'منظفات',
      },
    });
    expect(expense.statusCode).toBe(201);

    const pl1 = await get<ProfitAndLoss>(`/reports/profit-and-loss?${range()}`);
    expect(n(pl1.netSales) - n(pl0.netSales)).toBeCloseTo(100);
    expect(n(pl1.cogs) - n(pl0.cogs)).toBeCloseTo(40);
    expect(n(pl1.expensesTotal) - n(pl0.expensesTotal)).toBeCloseTo(15);
    expect(n(pl1.netProfit) - n(pl0.netProfit)).toBeCloseTo(45);
    expect(pl1.sales.count - pl0.sales.count).toBe(1);
    expect(pl1.expenses.find((e) => e.category === 'CLEANING')).toBeTruthy();

    const cash1 = await get<CashReport>(`/reports/cash?${range()}`);
    const drawer = (c: CashReport) => c.accounts.find((a) => a.account === 'CASH_DRAWER')!;
    expect(n(drawer(cash1).in) - n(drawer(cash0).in)).toBeCloseTo(100);
    expect(n(drawer(cash1).out) - n(drawer(cash0).out)).toBeCloseTo(15);
    const d = drawer(cash1);
    expect(n(d.closing)).toBeCloseTo(n(d.opening) + n(d.in) - n(d.out));

    // Managers see the same report without cost or profit.
    const asManager = await get<ProfitAndLoss>(
      `/reports/profit-and-loss?${range()}`,
      manager.headers,
    );
    expect(asManager).toMatchObject({ cogs: null, grossProfit: null, netProfit: null });
    expect(asManager.netSales).toBe(pl1.netSales);

    const byProduct = await get<SalesReportRow[]>(
      `/reports/sales?${range()}&groupBy=product`,
      manager.headers,
    );
    expect(byProduct.length).toBeGreaterThan(0);
    expect(byProduct[0]!.profit).toBeNull();
    const byStaff = await get<SalesReportRow[]>(`/reports/sales?${range()}&groupBy=staff`);
    expect(byStaff.some((r) => r.label === employee.user.name)).toBe(true);
  });

  it('debts are aged by the sale they come from; supplier debts by receipt', async () => {
    const customer = await createCustomer(ctx, employee.headers);
    const itemId = await newItem();
    await sell(ctx, employee.headers, {
      shiftId: shift.id,
      customerId: customer.id,
      lines: [{ itemId, quantity: 2, unitPrice: '100.00' }],
      payments: [cash('50.00')],
      acknowledgeOwed: true,
    });
    const debts = await get<DebtsReport>('/reports/debts', manager.headers);
    const row = debts.customers.find((c) => c.id === customer.id)!;
    expect(row).toMatchObject({ owed: '150.00', aging: { current: '150.00', days90: '0.00' } });
    expect(row.oldest).toBe(today);

    const supplier = (
      await ctx.app.inject({
        method: 'POST',
        url: '/suppliers',
        headers: admin.headers,
        payload: { name: `مورّد ${randomUUID().slice(0, 4)}` },
      })
    ).json<SupplierView>();
    const receipt = await ctx.app.inject({
      method: 'POST',
      url: '/purchasing/receipts',
      headers: admin.headers,
      payload: {
        idempotencyKey: randomUUID(),
        supplierId: supplier.id,
        lines: [{ itemId, quantity: 3, unitCost: '100' }],
      },
    });
    expect(receipt.json<ReceiptView>().total).toBe('300.00');
    const owed = await get<SupplierDebtsReport>('/reports/supplier-debts', manager.headers);
    expect(owed.suppliers.find((s) => s.id === supplier.id)).toMatchObject({
      owed: '300.00',
      aging: { current: '300.00' },
    });
  });

  it('inventory value equals the Inventory account in the ledger', async () => {
    // Pieces with no known cost take the first purchase cost, and the ledger follows.
    const p = await createProduct(ctx, admin.headers, {
      type: 'REGULAR',
      name: { ar: `شال ${randomUUID().slice(0, 4)}` },
      categoryId,
      stock: 1,
      price: '150.00',
    });
    const supplier = (
      await ctx.app.inject({
        method: 'POST',
        url: '/suppliers',
        headers: admin.headers,
        payload: { name: `مورّد ${randomUUID().slice(0, 4)}` },
      })
    ).json<SupplierView>();
    const received = await ctx.app.inject({
      method: 'POST',
      url: '/purchasing/receipts',
      headers: admin.headers,
      payload: {
        idempotencyKey: randomUUID(),
        supplierId: supplier.id,
        lines: [{ itemId: p.items[0]!.id, quantity: 4, unitCost: '95' }],
      },
    });
    expect(received.statusCode).toBe(201);
    const v = await get<InventoryValuation>('/reports/inventory');
    expect(v.totals.value).toBe(v.totals.ledger);
    const denied = await ctx.app.inject({
      method: 'GET',
      url: '/reports/inventory',
      headers: manager.headers,
    });
    expect(denied.statusCode).toBe(403);
  });

  it('the daily summary lists the day: sales, payments, expenses and shifts', async () => {
    const day = await get<DailySummary>(`/reports/daily?date=${today}`);
    expect(day.sales.count).toBeGreaterThan(0);
    expect(day.payments.some((p) => p.method === 'CASH' && p.direction === 'IN')).toBe(true);
    expect(day.shifts.some((s) => s.id === shift.id)).toBe(true);
    expect(day.grossProfit).not.toBeNull();
  });

  it('Today: employees see their own sales and no shop figures; reports are closed to them', async () => {
    const mine = await get<TodayView>('/dashboard/today', employee.headers);
    const shop = await get<TodayView>('/dashboard/today', manager.headers);
    const all = await get<TodayView>('/dashboard/today');
    expect(mine).toMatchObject({
      scope: 'OWN',
      debtsOwed: null,
      grossProfit: null,
      approvalsWaiting: 0,
    });
    expect(shop.scope).toBe('SHOP');
    expect(shop.grossProfit).toBeNull();
    expect(all.grossProfit).not.toBeNull();
    expect(n(shop.sales.total)).toBeGreaterThanOrEqual(n(mine.sales.total));
    expect(mine.last7).toHaveLength(7);
    expect(mine.last7.at(-1)!.date).toBe(today);

    const feed = await get<ActivityItem[]>('/activity?limit=20', employee.headers);
    expect(feed.every((a) => a.by === employee.user.name)).toBe(true);
    for (const url of ['/reports/debts', `/reports/profit-and-loss?${range()}`]) {
      const res = await ctx.app.inject({ method: 'GET', url, headers: employee.headers });
      expect(res.statusCode).toBe(403);
    }
  });
});
