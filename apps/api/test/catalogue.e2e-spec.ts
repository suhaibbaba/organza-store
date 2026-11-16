import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { auditLog, stockMovements } from '../src/database/schema/index.js';
import { LedgerService } from '../src/modules/ledger/services/ledger.service.js';
import { createCategory, createProduct, optionValues } from './helpers/catalogue.js';
import { signedIn } from './helpers/fixtures.js';
import { createTestContext, type TestContext } from './helpers/test-app.js';

describe('catalogue', () => {
  let ctx: TestContext;
  let admin: Awaited<ReturnType<typeof signedIn>>;
  let employee: Awaited<ReturnType<typeof signedIn>>;
  let categoryId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await signedIn(ctx, 'ADMIN');
    employee = await signedIn(ctx, 'EMPLOYEE');
    categoryId = (await createCategory(ctx, admin.headers)).id;
  });
  afterAll(() => ctx.close());

  it('creates a regular product with stock 1, an EAN-13 and an opening stock entry', async () => {
    const p = await createProduct(ctx, admin.headers, {
      type: 'REGULAR',
      name: { ar: 'شال حرير', en: 'Silk shawl' },
      categoryId,
      cost: '40.00',
    });
    expect(p.items).toHaveLength(1);
    const item = p.items[0]!;
    expect(item.sku).toBe(`ORG-${String(p.number).padStart(5, '0')}`);
    expect(item.barcodes[0]!.code).toMatch(/^200\d{10}$/);
    expect(item.stock).toEqual({ onHand: 1, reserved: 0, damaged: 0, available: 1 });
    expect(item.avgCost).toBe('40.0000');
    const ledger = ctx.app.get(LedgerService);
    const entries = await ledger.entriesFor(ctx.db, 'product', p.id);
    expect(entries).toHaveLength(1);
    const audit = await ctx.db.select().from(auditLog).where(eq(auditLog.entityId, p.id));
    expect(audit.map((a) => a.action)).toContain('CREATE');
  });

  it('hides cost from non-admins and ignores a cost they send', async () => {
    const p = await createProduct(ctx, employee.headers, {
      type: 'REGULAR',
      name: { ar: 'حقيبة' },
      categoryId,
      cost: '10.00',
    });
    expect(p.items[0]!.avgCost).toBeUndefined();
    const [m] = await ctx.db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.itemId, p.items[0]!.id));
    expect(m!.costUnknown).toBe(true);
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/products/unknown-cost',
      headers: employee.headers,
    });
    expect(res.statusCode).toBe(403);
  });

  it('creates only the ticked variant combinations, with a shared supplier code', async () => {
    const sizes = await optionValues(ctx, admin.headers, 'size', ['S', 'M', 'L']);
    const colors = await optionValues(ctx, admin.headers, 'color', ['Red', 'Blue']);
    const shared = `SUP${Date.now()}`;
    const p = await createProduct(ctx, admin.headers, {
      type: 'VARIANT',
      name: { ar: 'فستان', en: 'Dress' },
      categoryId,
      optionTypeIds: [sizes.typeId, colors.typeId],
      sharedBarcode: shared,
      items: [
        { valueIds: [sizes.ids[0], colors.ids[0]], stock: 2 },
        { valueIds: [sizes.ids[1], colors.ids[1]], stock: 0, price: '120.00' },
      ],
    });
    expect(p.items).toHaveLength(2);
    expect(p.items[1]!.effectivePrice).toBe('120.00');
    expect(p.items[0]!.options).toHaveLength(2);
    expect(p.sharedBarcodes).toEqual([shared]);
    const lookup = await ctx.app.inject({
      method: 'GET',
      url: `/products/lookup/${shared}`,
      headers: employee.headers,
    });
    expect(lookup.json()).toMatchObject({ productId: p.id, itemId: null });
  });

  it('refuses a combination that does not cover every option or repeats', async () => {
    const sizes = await optionValues(ctx, admin.headers, 'size', ['S']);
    const colors = await optionValues(ctx, admin.headers, 'color', ['Red']);
    const base = {
      idempotencyKey: randomUUID(),
      type: 'VARIANT',
      name: { ar: 'x' },
      categoryId,
      price: '1.00',
      optionTypeIds: [sizes.typeId, colors.typeId],
    };
    const missing = await ctx.app.inject({
      method: 'POST',
      url: '/products',
      headers: admin.headers,
      payload: { ...base, items: [{ valueIds: [sizes.ids[0]] }] },
    });
    expect(missing.json().code).toBe('INVALID_COMBINATION');
    const dup = await ctx.app.inject({
      method: 'POST',
      url: '/products',
      headers: admin.headers,
      payload: {
        ...base,
        idempotencyKey: randomUUID(),
        items: [
          { valueIds: [sizes.ids[0], colors.ids[0]] },
          { valueIds: [colors.ids[0], sizes.ids[0]] },
        ],
      },
    });
    expect(dup.json().code).toBe('DUPLICATE_COMBINATION');
  });

  it('creates numbered items with their own SKUs and marker positions', async () => {
    const p = await createProduct(ctx, admin.headers, {
      type: 'NUMBERED',
      name: { ar: 'شالات مرقمة' },
      categoryId,
      pointTextColor: '#ffffff',
      items: [
        { number: 1, photoX: 10, photoY: 20 },
        { number: 7, photoX: 50, photoY: 50, price: '80.00' },
      ],
    });
    expect(p.items.map((i) => i.sku)).toEqual([
      `ORG-${String(p.number).padStart(5, '0')}-1`,
      `ORG-${String(p.number).padStart(5, '0')}-7`,
    ]);
    expect(p.items[1]!.photoX).toBe('50.00');
  });

  it('refuses a barcode another product already holds, naming it', async () => {
    const code = `X${Date.now()}`;
    const first = await createProduct(ctx, admin.headers, {
      type: 'REGULAR',
      name: { ar: 'أول' },
      categoryId,
      barcode: code,
    });
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/products',
      headers: admin.headers,
      payload: {
        idempotencyKey: randomUUID(),
        type: 'REGULAR',
        name: { ar: 'ثاني' },
        categoryId,
        price: '1.00',
        barcode: code,
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('BARCODE_TAKEN');
    expect(res.json().details.holders[0].productId).toBe(first.id);
  });

  it('replays a repeated create instead of making a second product', async () => {
    const key = randomUUID();
    const payload = {
      idempotencyKey: key,
      type: 'REGULAR',
      name: { ar: 'مكرر' },
      categoryId,
      price: '5.00',
    };
    const a = await ctx.app.inject({
      method: 'POST',
      url: '/products',
      headers: admin.headers,
      payload,
    });
    const b = await ctx.app.inject({
      method: 'POST',
      url: '/products',
      headers: admin.headers,
      payload,
    });
    expect(a.json().id).toBe(b.json().id);
  });

  it('finds products with Arabic spelling variants, SKU and barcode', async () => {
    const p = await createProduct(ctx, admin.headers, {
      type: 'REGULAR',
      name: { ar: 'عباءة مطرّزة' },
      categoryId,
    });
    const search = async (q: string) => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/products?q=${encodeURIComponent(q)}`,
        headers: employee.headers,
      });
      if (res.statusCode !== 200) throw new Error(`${res.statusCode} ${res.body}`);
      return res.json<{ items: { id: string }[] }>().items.map((i) => i.id);
    };
    expect(await search('عباءه مطرزه')).toContain(p.id);
    expect(await search(p.items[0]!.sku)).toContain(p.id);
    expect(await search(p.items[0]!.barcodes[0]!.code)).toContain(p.id);
  });

  it('employees cannot change prices; a stale version is refused', async () => {
    const p = await createProduct(ctx, admin.headers, {
      type: 'REGULAR',
      name: { ar: 'سعر' },
      categoryId,
    });
    const denied = await ctx.app.inject({
      method: 'PATCH',
      url: `/products/${p.id}`,
      headers: employee.headers,
      payload: { version: p.version, price: '1.00' },
    });
    expect(denied.statusCode).toBe(403);
    const ok = await ctx.app.inject({
      method: 'PATCH',
      url: `/products/${p.id}`,
      headers: admin.headers,
      payload: { version: p.version, price: '150.00' },
    });
    expect(ok.json().price).toBe('150.00');
    const stale = await ctx.app.inject({
      method: 'PATCH',
      url: `/products/${p.id}`,
      headers: admin.headers,
      payload: { version: p.version, name: { ar: 'جديد' } },
    });
    expect(stale.json().code).toBe('STALE_VERSION');
  });

  it('archives with a write-off that moves the stock value to loss', async () => {
    const p = await createProduct(ctx, admin.headers, {
      type: 'REGULAR',
      name: { ar: 'أرشيف' },
      categoryId,
      stock: 3,
      cost: '10.00',
    });
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/products/${p.id}/archive`,
      headers: admin.headers,
      payload: { stock: 'WRITE_OFF', reason: 'old' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('ARCHIVED');
    expect(res.json().items[0].stock.onHand).toBe(0);
    const ledger = ctx.app.get(LedgerService);
    const [entry] = await ledger.entriesFor(ctx.db, 'product_archive', p.id);
    expect(entry).toBeDefined();
  });

  it('filling in an unknown cost books the stock still on hand', async () => {
    const p = await createProduct(ctx, employee.headers, {
      type: 'REGULAR',
      name: { ar: 'تكلفة' },
      categoryId,
      stock: 2,
    });
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/items/${p.items[0]!.id}/cost`,
      headers: admin.headers,
      payload: { cost: '25.00' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().items[0].avgCost).toBe('25.0000');
    const again = await ctx.app.inject({
      method: 'POST',
      url: `/items/${p.items[0]!.id}/cost`,
      headers: admin.headers,
      payload: { cost: '30.00' },
    });
    expect(again.json().code).toBe('COST_ALREADY_KNOWN');
  });
});
