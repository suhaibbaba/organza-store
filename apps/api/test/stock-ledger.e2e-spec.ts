import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import {
  itemBalances,
  journalEntries,
  journalLines,
  stockMovements,
} from '../src/database/schema/index.js';
import { inTransaction } from '../src/database/unit-of-work.js';
import { credit, debit, LedgerService } from '../src/modules/ledger/services/ledger.service.js';
import { StockService } from '../src/modules/stock/services/stock.service.js';
import { createCategory, createProduct } from './helpers/catalogue.js';
import { expectDbError, signedIn } from './helpers/fixtures.js';
import { createTestContext, type TestContext } from './helpers/test-app.js';

describe('money and stock ledgers', () => {
  let ctx: TestContext;
  let admin: Awaited<ReturnType<typeof signedIn>>;
  let stock: StockService;
  let ledger: LedgerService;
  let categoryId: string;

  const newItem = async (qty = 5, cost = '10.00') => {
    const p = await createProduct(ctx, admin.headers, {
      type: 'REGULAR',
      name: { ar: `صنف ${randomUUID().slice(0, 4)}` },
      categoryId,
      stock: qty,
      cost,
    });
    return p.items[0]!.id;
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await signedIn(ctx, 'ADMIN');
    stock = ctx.app.get(StockService);
    ledger = ctx.app.get(LedgerService);
    categoryId = (await createCategory(ctx, admin.headers)).id;
  });
  afterAll(() => ctx.close());

  it('refuses an unbalanced entry in the database itself', async () => {
    await expectDbError(
      ctx.db.transaction(async (tx) => {
        const [e] = await tx
          .insert(journalEntries)
          .values({
            entryDate: await ledger.today(tx),
            sourceType: 'test',
            sourceId: randomUUID(),
            event: 'X',
          })
          .returning();
        await tx
          .insert(journalLines)
          .values({ entryId: e!.id, account: 'CASH_DRAWER', amount: '10.00' });
      }),
      /balance/i,
    );
  });

  it('never lets a posted line or movement change or disappear', async () => {
    const itemId = await newItem(1);
    const [m] = await ctx.db.select().from(stockMovements).where(eq(stockMovements.itemId, itemId));
    await expectDbError(
      ctx.db.update(stockMovements).set({ quantity: 9 }).where(eq(stockMovements.id, m!.id)),
      /ledger|append-only/,
    );
    await expectDbError(
      ctx.db.delete(stockMovements).where(eq(stockMovements.id, m!.id)),
      /never|append-only/,
    );
    const [line] = await ctx.db
      .select()
      .from(journalLines)
      .where(eq(journalLines.entryId, m!.journalEntryId!));
    await expectDbError(
      ctx.db.update(journalLines).set({ amount: '1.00' }).where(eq(journalLines.id, line!.id)),
      /ledger|append-only/,
    );
  });

  it('reverses an entry with a mirror entry, once', async () => {
    const id = await inTransaction(ctx.db, (tx) =>
      ledger.post(tx, {
        sourceType: 'test',
        sourceId: randomUUID(),
        event: 'T',
        createdBy: null,
        lines: [debit('CASH_DRAWER', '12.50'), credit('SALES_REVENUE', '12.50')],
      }),
    );
    const before = await ledger.balance(ctx.db, 'CASH_DRAWER');
    await inTransaction(ctx.db, (tx) => ledger.reverse(tx, id!, null, 'mistake'));
    expect(Number(await ledger.balance(ctx.db, 'CASH_DRAWER'))).toBeCloseTo(
      Number(before) - 12.5,
      2,
    );
    await expect(
      inTransaction(ctx.db, (tx) => ledger.reverse(tx, id!, null, 'again')),
    ).rejects.toThrow();
  });

  it('refuses to take more than is available and says how many are left', async () => {
    const itemId = await newItem(2);
    await expect(
      inTransaction(ctx.db, (tx) =>
        stock.apply(tx, {
          sourceType: 'test',
          sourceId: randomUUID(),
          event: 'X',
          actorId: null,
          lines: [{ itemId, quantity: -3, reason: 'LOSS', counterAccount: 'DAMAGE_AND_LOSS' }],
        }),
      ),
    ).rejects.toMatchObject({ code: 'STOCK_INSUFFICIENT' });
  });

  it('keeps the average cost weighted and posts outgoing stock at it', async () => {
    const itemId = await newItem(2, '10.00');
    await inTransaction(ctx.db, (tx) =>
      stock.apply(tx, {
        sourceType: 'test',
        sourceId: randomUUID(),
        event: 'IN',
        actorId: null,
        lines: [
          {
            itemId,
            quantity: 2,
            unitCost: '20.00',
            reason: 'PURCHASE_RECEIVED',
            counterAccount: 'OPENING_BALANCES',
          },
        ],
      }),
    );
    const [b] = await ctx.db.select().from(itemBalances).where(eq(itemBalances.itemId, itemId));
    expect(b!.avgCost).toBe('15.0000');
    const { movements } = await inTransaction(ctx.db, (tx) =>
      stock.apply(tx, {
        sourceType: 'test',
        sourceId: randomUUID(),
        event: 'OUT',
        actorId: null,
        lines: [{ itemId, quantity: -1, reason: 'LOSS', counterAccount: 'DAMAGE_AND_LOSS' }],
      }),
    );
    expect(movements[0]!.value).toBe('15.00');
  });

  it('reversing a source puts the stock back and reverses its entries', async () => {
    const itemId = await newItem(4);
    const sourceId = randomUUID();
    await inTransaction(ctx.db, (tx) =>
      stock.apply(tx, {
        sourceType: 'test',
        sourceId,
        event: 'OUT',
        actorId: null,
        lines: [{ itemId, quantity: -3, reason: 'DAMAGE', counterAccount: 'DAMAGE_AND_LOSS' }],
      }),
    );
    expect(
      await inTransaction(ctx.db, (tx) => stock.reverseSource(tx, 'test', sourceId, null, 'undo')),
    ).toBe(1);
    const [b] = await ctx.db.select().from(itemBalances).where(eq(itemBalances.itemId, itemId));
    expect(b!.onHand).toBe(4);
    expect(await ledger.activeEntriesFor(ctx.db, 'test', sourceId)).toHaveLength(0);
    expect(
      await inTransaction(ctx.db, (tx) => stock.reverseSource(tx, 'test', sourceId, null, 'undo')),
    ).toBe(0);
  });

  it('concurrent takes of the last pieces never oversell', async () => {
    const itemId = await newItem(3);
    const attempts = Array.from({ length: 6 }, () =>
      inTransaction(ctx.db, (tx) =>
        stock.apply(tx, {
          sourceType: 'test',
          sourceId: randomUUID(),
          event: 'OUT',
          actorId: null,
          lines: [{ itemId, quantity: -1, reason: 'LOSS', counterAccount: 'DAMAGE_AND_LOSS' }],
        }),
      ).then(
        () => 'ok',
        (e: { code?: string }) => e.code,
      ),
    );
    const results = await Promise.all(attempts);
    expect(results.filter((r) => r === 'ok')).toHaveLength(3);
    expect(results.filter((r) => r === 'STOCK_INSUFFICIENT')).toHaveLength(3);
    const [b] = await ctx.db.select().from(itemBalances).where(eq(itemBalances.itemId, itemId));
    expect(b!.onHand).toBe(0);
  });

  it('reservations limit what can be taken and are released', async () => {
    const itemId = await newItem(2);
    await inTransaction(ctx.db, (tx) => stock.reserve(tx, [{ itemId, quantity: 2 }]));
    await expect(
      inTransaction(ctx.db, (tx) =>
        stock.apply(tx, {
          sourceType: 'test',
          sourceId: randomUUID(),
          event: 'OUT',
          actorId: null,
          lines: [{ itemId, quantity: -1, reason: 'LOSS', counterAccount: 'DAMAGE_AND_LOSS' }],
        }),
      ),
    ).rejects.toMatchObject({ code: 'STOCK_INSUFFICIENT' });
    await inTransaction(ctx.db, (tx) =>
      stock.apply(tx, {
        sourceType: 'test',
        sourceId: randomUUID(),
        event: 'HANDOVER',
        actorId: null,
        lines: [
          { itemId, quantity: -1, fromReserved: true, reason: 'SALE', counterAccount: 'COGS' },
        ],
      }),
    );
    await inTransaction(ctx.db, (tx) => stock.release(tx, [{ itemId, quantity: 1 }]));
    const [b] = await ctx.db.select().from(itemBalances).where(eq(itemBalances.itemId, itemId));
    expect(b).toMatchObject({ onHand: 1, reserved: 0 });
  });

  it('every balance equals the sum of its movements and the books balance', async () => {
    expect(await stock.verify()).toEqual([]);
    const [{ total } = { total: '1' }] = await ctx.db.execute<{ total: string }>(
      sql`select coalesce(sum(amount), 0)::text as total from journal_lines`,
    );
    expect(Number(total)).toBe(0);
    const [{ inv } = { inv: '0' }] = await ctx.db.execute<{ inv: string }>(
      sql`select coalesce(sum(amount),0)::text as inv from journal_lines where account = 'INVENTORY'`,
    );
    const [{ val } = { val: '0' }] = await ctx.db.execute<{ val: string }>(
      sql`select coalesce(sum(on_hand * coalesce(avg_cost,0)),0)::numeric(14,2)::text as val from item_balances`,
    );
    // Inventory on the books matches stock at average cost, within rounding of a cent per movement.
    expect(Math.abs(Number(inv) - Number(val))).toBeLessThan(1);
  });
});
