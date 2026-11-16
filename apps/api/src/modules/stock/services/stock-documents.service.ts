import { Injectable } from '@nestjs/common';
import {
  type AdjustmentReason,
  type CountView,
  type countLinesSchema,
  type createAdjustmentSchema,
  type createCountSchema,
  localize,
  type MovementRow,
  normalizeSearch,
  type stockListQuerySchema,
  type StockRow,
} from '@organza/shared';
import { and, asc, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../../common/decorators/auth.decorators.js';
import { badRequest, conflict, notFound } from '../../../common/lib/app-error.js';
import { AuditService } from '../../../common/services/audit.service.js';
import { DocumentsService } from '../../../common/services/documents.service.js';
import { IdempotencyService } from '../../../common/services/idempotency.service.js';
import { InjectDb } from '../../../database/database.module.js';
import {
  itemBalances,
  itemOptionValues,
  items,
  optionValues,
  products,
  stockAdjustmentLines,
  stockAdjustments,
  stockCountLines,
  stockCounts,
  stockMovements,
} from '../../../database/schema/index.js';
import { type Database, type Executor, inTransaction } from '../../../database/unit-of-work.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { type StockLine, StockService } from './stock.service.js';

export const STOCK_DOC_ERRORS = {
  COUNT_NOT_OPEN: 'COUNT_NOT_OPEN',
  COUNT_EMPTY: 'COUNT_EMPTY',
  COUNTED_ONLY_FOR_CORRECTIONS: 'COUNTED_ONLY_FOR_CORRECTIONS',
  WRONG_SIGN: 'ADJUSTMENT_WRONG_SIGN',
  ALREADY_REVERSED: 'ALREADY_REVERSED',
  NO_CHANGE: 'ADJUSTMENT_NO_CHANGE',
} as const;

/** Which direction each reason may move stock in. */
const SIGN: Record<AdjustmentReason, 'IN' | 'OUT' | 'ANY'> = {
  DAMAGE: 'OUT',
  LOSS: 'OUT',
  FOUND: 'IN',
  WRITE_OFF_DAMAGED: 'OUT',
  COUNT_ADJUSTMENT: 'ANY',
};

@Injectable()
export class StockDocumentsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly stock: StockService,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
    private readonly idempotency: IdempotencyService,
    private readonly settings: SettingsService,
  ) {}

  // ------------------------------------------------------------ adjustments

  async createAdjustment(actor: Actor, input: z.output<typeof createAdjustmentSchema>) {
    const { result } = await this.idempotency.run(
      'stock.adjust',
      input.idempotencyKey,
      actor.id,
      input,
      async (tx) => {
        const balances = await this.stock.lock(
          tx,
          input.lines.map((l) => l.itemId),
        );
        const sign = SIGN[input.reason];
        const resolved = input.lines.map((line) => {
          const b = balances.get(line.itemId)!;
          if (line.counted !== undefined && input.reason !== 'COUNT_ADJUSTMENT') {
            throw badRequest(
              STOCK_DOC_ERRORS.COUNTED_ONLY_FOR_CORRECTIONS,
              'A counted quantity is only for corrections',
            );
          }
          const previous = input.reason === 'WRITE_OFF_DAMAGED' ? b.damaged : b.onHand;
          const delta = line.counted !== undefined ? line.counted - b.onHand : line.delta!;
          if (delta === 0)
            throw badRequest(STOCK_DOC_ERRORS.NO_CHANGE, 'Nothing changes for this item', {
              itemId: line.itemId,
            });
          if ((sign === 'IN' && delta < 0) || (sign === 'OUT' && delta > 0)) {
            throw badRequest(STOCK_DOC_ERRORS.WRONG_SIGN, `${input.reason} cannot go that way`, {
              itemId: line.itemId,
            });
          }
          return { itemId: line.itemId, delta, counted: line.counted ?? null, previous };
        });

        const number = await this.documents.next(tx, 'ADJ');
        const [doc] = await tx
          .insert(stockAdjustments)
          .values({ number, reason: input.reason, note: input.note ?? null, createdBy: actor.id })
          .returning();
        await tx.insert(stockAdjustmentLines).values(
          resolved.map((r) => ({
            adjustmentId: doc!.id,
            itemId: r.itemId,
            bucket:
              input.reason === 'WRITE_OFF_DAMAGED' ? ('DAMAGED' as const) : ('ON_HAND' as const),
            delta: r.delta,
            countedQuantity: r.counted,
            previousQuantity: r.previous,
          })),
        );
        await this.stock.apply(tx, {
          sourceType: 'stock_adjustment',
          sourceId: doc!.id,
          event: `ADJUSTMENT_${input.reason}`,
          actorId: actor.id,
          lines: resolved.flatMap((r) =>
            this.linesFor(input.reason, r.itemId, r.delta, input.note),
          ),
        });
        await this.audit.record(tx, {
          userId: actor.id,
          action: 'STOCK_ADJUST',
          entity: 'stock_adjustment',
          entityId: doc!.id,
          newValue: { number, reason: input.reason, lines: resolved },
          reason: input.note ?? null,
        });
        return { id: doc!.id, number };
      },
    );
    return this.getAdjustment(result.id);
  }

  /**
   * Value side: losses and damage go to Damage and loss; found stock comes back from it;
   * damaged pieces carry no value (it was expensed when they were moved there).
   */
  private linesFor(
    reason: AdjustmentReason,
    itemId: string,
    delta: number,
    note?: string,
  ): StockLine[] {
    const base = { itemId, counterAccount: 'DAMAGE_AND_LOSS' as const, ...(note && { note }) };
    switch (reason) {
      case 'DAMAGE':
        return [
          { ...base, quantity: delta, reason: 'MOVE_TO_DAMAGED' },
          {
            ...base,
            bucket: 'DAMAGED',
            quantity: -delta,
            reason: 'MOVE_TO_DAMAGED',
            unitCost: '0',
          },
        ];
      case 'WRITE_OFF_DAMAGED':
        return [
          {
            ...base,
            bucket: 'DAMAGED',
            quantity: delta,
            reason: 'WRITE_OFF_DAMAGED',
            unitCost: '0',
          },
        ];
      default:
        return [{ ...base, quantity: delta, reason }];
    }
  }

  async reverseAdjustment(actor: Actor, id: string, reason: string) {
    await inTransaction(this.db, async (tx) => {
      const [doc] = await tx
        .select()
        .from(stockAdjustments)
        .where(eq(stockAdjustments.id, id))
        .for('update');
      if (!doc) throw notFound('Adjustment');
      const reversed = await this.stock.reverseSource(tx, 'stock_adjustment', id, actor.id, reason);
      if (reversed === 0) throw conflict(STOCK_DOC_ERRORS.ALREADY_REVERSED, 'Already reversed');
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'REVERSE',
        entity: 'stock_adjustment',
        entityId: id,
        reason,
      });
    });
    return this.getAdjustment(id);
  }

  async getAdjustment(id: string) {
    const [doc] = await this.db.select().from(stockAdjustments).where(eq(stockAdjustments.id, id));
    if (!doc) throw notFound('Adjustment');
    const lines = await this.db
      .select({ line: stockAdjustmentLines, sku: items.sku, name: products.name })
      .from(stockAdjustmentLines)
      .innerJoin(items, eq(items.id, stockAdjustmentLines.itemId))
      .innerJoin(products, eq(products.id, items.productId))
      .where(eq(stockAdjustmentLines.adjustmentId, id));
    const [rev] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.sourceType, 'stock_adjustment'),
          eq(stockMovements.sourceId, id),
          sql`${stockMovements.reversesId} is not null`,
        ),
      );
    return {
      ...doc,
      reversed: Boolean(rev?.n),
      lines: lines.map((l) => ({ ...l.line, sku: l.sku, name: l.name })),
    };
  }

  async listAdjustments(page = 1, pageSize = 30) {
    const rows = await this.db
      .select({
        doc: stockAdjustments,
        lineCount: sql<number>`(select count(*)::int from stock_adjustment_lines l where l.adjustment_id = ${sql.raw('stock_adjustments.id')})`,
        units: sql<number>`(select coalesce(sum(l.delta),0)::int from stock_adjustment_lines l where l.adjustment_id = ${sql.raw('stock_adjustments.id')})`,
        reversed: sql<boolean>`exists (select 1 from stock_movements m where m.source_type = 'stock_adjustment' and m.source_id = ${sql.raw('stock_adjustments.id')} and m.reverses_id is not null)`,
      })
      .from(stockAdjustments)
      .orderBy(desc(stockAdjustments.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return rows.map((r) => ({
      ...r.doc,
      lineCount: r.lineCount,
      units: r.units,
      reversed: r.reversed,
    }));
  }

  // ------------------------------------------------------------ counts

  async createCount(actor: Actor, input: z.output<typeof createCountSchema>) {
    const id = await inTransaction(this.db, async (tx) => {
      const number = await this.documents.next(tx, 'CNT');
      const [row] = await tx
        .insert(stockCounts)
        .values({ number, title: input.title, note: input.note ?? null, createdBy: actor.id })
        .returning();
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'CREATE',
        entity: 'stock_count',
        entityId: row!.id,
        newValue: row,
      });
      return row!.id;
    });
    return this.getCount(id);
  }

  /** Records counted quantities; counting the same item again replaces the earlier figure. */
  async countLines(actor: Actor, countId: string, input: z.output<typeof countLinesSchema>) {
    await inTransaction(this.db, async (tx) => {
      const [count] = await tx
        .select()
        .from(stockCounts)
        .where(eq(stockCounts.id, countId))
        .for('update');
      if (!count) throw notFound('Count');
      if (count.status !== 'OPEN')
        throw conflict(STOCK_DOC_ERRORS.COUNT_NOT_OPEN, 'This count is closed');
      const found = await tx
        .select({ id: items.id })
        .from(items)
        .where(
          inArray(
            items.id,
            input.lines.map((l) => l.itemId),
          ),
        );
      if (found.length !== new Set(input.lines.map((l) => l.itemId)).size) throw notFound('Item');
      for (const line of input.lines) {
        await tx
          .insert(stockCountLines)
          .values({ countId, itemId: line.itemId, counted: line.counted, countedBy: actor.id })
          .onConflictDoUpdate({
            target: [stockCountLines.countId, stockCountLines.itemId],
            set: { counted: line.counted, countedBy: actor.id, countedAt: new Date() },
          });
      }
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'COUNT_LINES',
        entity: 'stock_count',
        entityId: countId,
        newValue: input.lines,
      });
    });
    return this.getCount(countId);
  }

  /** Only counted items change: each difference becomes a COUNT_ADJUSTMENT movement. */
  async postCount(actor: Actor, countId: string) {
    await inTransaction(this.db, async (tx) => {
      const [count] = await tx
        .select()
        .from(stockCounts)
        .where(eq(stockCounts.id, countId))
        .for('update');
      if (!count) throw notFound('Count');
      if (count.status !== 'OPEN')
        throw conflict(STOCK_DOC_ERRORS.COUNT_NOT_OPEN, 'This count is closed');
      const lines = await tx
        .select()
        .from(stockCountLines)
        .where(eq(stockCountLines.countId, countId));
      if (lines.length === 0)
        throw badRequest(STOCK_DOC_ERRORS.COUNT_EMPTY, 'Nothing has been counted');
      const balances = await this.stock.lock(
        tx,
        lines.map((l) => l.itemId),
      );
      for (const line of lines) {
        await tx
          .update(stockCountLines)
          .set({ systemQuantity: balances.get(line.itemId)!.onHand })
          .where(
            and(eq(stockCountLines.countId, countId), eq(stockCountLines.itemId, line.itemId)),
          );
      }
      const changes: StockLine[] = lines
        .map((l) => ({ itemId: l.itemId, delta: l.counted - balances.get(l.itemId)!.onHand }))
        .filter((c) => c.delta !== 0)
        .map((c) => ({
          itemId: c.itemId,
          quantity: c.delta,
          reason: 'COUNT_ADJUSTMENT',
          counterAccount: 'DAMAGE_AND_LOSS',
          note: count.number,
        }));
      if (changes.length) {
        await this.stock.apply(tx, {
          sourceType: 'stock_count',
          sourceId: countId,
          event: 'COUNT_POSTED',
          actorId: actor.id,
          lines: changes,
        });
      }
      await tx
        .update(stockCounts)
        .set({ status: 'POSTED', postedBy: actor.id, postedAt: new Date() })
        .where(eq(stockCounts.id, countId));
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'POST',
        entity: 'stock_count',
        entityId: countId,
        newValue: { changed: changes.length, counted: lines.length },
      });
    });
    return this.getCount(countId);
  }

  async cancelCount(actor: Actor, countId: string) {
    await inTransaction(this.db, async (tx) => {
      const [count] = await tx
        .select()
        .from(stockCounts)
        .where(eq(stockCounts.id, countId))
        .for('update');
      if (!count) throw notFound('Count');
      if (count.status !== 'OPEN')
        throw conflict(STOCK_DOC_ERRORS.COUNT_NOT_OPEN, 'This count is closed');
      await tx
        .update(stockCounts)
        .set({ status: 'CANCELLED', cancelledAt: new Date() })
        .where(eq(stockCounts.id, countId));
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'CANCEL',
        entity: 'stock_count',
        entityId: countId,
      });
    });
    return this.getCount(countId);
  }

  async getCount(id: string, executor: Executor = this.db): Promise<CountView> {
    const [count] = await executor.select().from(stockCounts).where(eq(stockCounts.id, id));
    if (!count) throw notFound('Count');
    const lines = await executor
      .select({
        line: stockCountLines,
        sku: items.sku,
        name: products.name,
        onHand: itemBalances.onHand,
      })
      .from(stockCountLines)
      .innerJoin(items, eq(items.id, stockCountLines.itemId))
      .innerJoin(products, eq(products.id, items.productId))
      .leftJoin(itemBalances, eq(itemBalances.itemId, items.id))
      .where(eq(stockCountLines.countId, id))
      .orderBy(asc(items.sku));
    return {
      id: count.id,
      number: count.number,
      title: count.title,
      status: count.status,
      note: count.note,
      createdAt: count.createdAt.toISOString(),
      postedAt: count.postedAt?.toISOString() ?? null,
      lines: lines.map((l) => {
        const system = l.line.systemQuantity ?? l.onHand ?? 0;
        return {
          itemId: l.line.itemId,
          sku: l.sku,
          name: l.name,
          counted: l.line.counted,
          system,
          difference: l.line.counted - system,
          countedAt: l.line.countedAt.toISOString(),
        };
      }),
    };
  }

  listCounts() {
    return this.db.select().from(stockCounts).orderBy(desc(stockCounts.createdAt)).limit(100);
  }

  // ------------------------------------------------------------ views

  async list(query: z.output<typeof stockListQuerySchema>) {
    const threshold = (await this.settings.get()).lowStockThreshold;
    const conditions: (SQL | undefined)[] = [
      isNull(items.archivedAt),
      sql`${products.status} <> 'ARCHIVED'`,
    ];
    if (query.categoryId) conditions.push(eq(products.categoryId, query.categoryId));
    const available = sql`(coalesce(${itemBalances.onHand},0) - coalesce(${itemBalances.reserved},0))`;
    const low = sql<boolean>`${available} <= coalesce(${products.lowStockThreshold}, ${threshold})`;
    if (query.lowStock) conditions.push(low);
    if (query.damaged) conditions.push(sql`coalesce(${itemBalances.damaged},0) > 0`);
    if (query.q) {
      const q = normalizeSearch(query.q);
      conditions.push(
        sql`(${products.searchText} ilike ${`%${q}%`} or ${items.sku} ilike ${`%${query.q.trim()}%`})`,
      );
    }
    const where = and(...conditions);
    const [{ total } = { total: 0 }] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(items)
      .innerJoin(products, eq(products.id, items.productId))
      .leftJoin(itemBalances, eq(itemBalances.itemId, items.id))
      .where(where);
    const rows = await this.db
      .select({
        itemId: items.id,
        productId: products.id,
        productNumber: products.number,
        sku: items.sku,
        name: products.name,
        location: items.location,
        onHand: sql<number>`coalesce(${itemBalances.onHand},0)`,
        reserved: sql<number>`coalesce(${itemBalances.reserved},0)`,
        damaged: sql<number>`coalesce(${itemBalances.damaged},0)`,
        low,
      })
      .from(items)
      .innerJoin(products, eq(products.id, items.productId))
      .leftJoin(itemBalances, eq(itemBalances.itemId, items.id))
      .where(where)
      .orderBy(asc(products.number), asc(items.number))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    const options = await this.optionLabels(rows.map((r) => r.itemId));
    const result: StockRow[] = rows.map((r) => ({
      itemId: r.itemId,
      productId: r.productId,
      productNumber: r.productNumber,
      sku: r.sku,
      name: r.name,
      options: options.get(r.itemId) ?? [],
      onHand: Number(r.onHand),
      reserved: Number(r.reserved),
      damaged: Number(r.damaged),
      available: Number(r.onHand) - Number(r.reserved),
      lowStock: Boolean(r.low),
      location: r.location,
    }));
    return { items: result, total, page: query.page, pageSize: query.pageSize };
  }

  private async optionLabels(itemIds: string[]) {
    const map = new Map<string, string[]>();
    if (itemIds.length === 0) return map;
    const rows = await this.db
      .select({ itemId: itemOptionValues.itemId, value: optionValues.value })
      .from(itemOptionValues)
      .innerJoin(optionValues, eq(optionValues.id, itemOptionValues.valueId))
      .where(inArray(itemOptionValues.itemId, itemIds));
    for (const r of rows)
      map.set(r.itemId, [...(map.get(r.itemId) ?? []), localize(r.value, 'ar')]);
    return map;
  }

  async history(itemId: string): Promise<MovementRow[]> {
    const rows = await this.db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.itemId, itemId))
      .orderBy(desc(stockMovements.occurredAt), desc(stockMovements.id))
      .limit(500);
    return rows.map((m) => ({
      id: m.id,
      occurredAt: m.occurredAt.toISOString(),
      bucket: m.bucket,
      quantity: m.quantity,
      reason: m.reason,
      sourceType: m.sourceType,
      sourceId: m.sourceId,
      note: m.note,
      createdBy: m.createdBy,
      reversed: m.reversedAt !== null,
      isReversal: m.reversesId !== null,
    }));
  }
}
