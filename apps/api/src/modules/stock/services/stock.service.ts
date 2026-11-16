import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { AccountCode, StockBucket, StockReason } from '@organza/shared';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { conflict, notFound } from '../../../common/lib/app-error.js';
import { InjectDb } from '../../../database/database.module.js';
import { itemBalances, items, stockMovements } from '../../../database/schema/index.js';
import type { Database, Executor, Transaction } from '../../../database/unit-of-work.js';
import { JobsService } from '../../jobs/jobs.service.js';
import {
  credit,
  debit,
  LedgerService,
  type PartyType,
  type PostingLine,
} from '../../ledger/services/ledger.service.js';
import { averageIn, averageOut, valueOf } from '../lib/costing.js';

export const STOCK_ERRORS = {
  INSUFFICIENT: 'STOCK_INSUFFICIENT',
  RESERVED_INSUFFICIENT: 'STOCK_RESERVED_INSUFFICIENT',
  DAMAGED_INSUFFICIENT: 'STOCK_DAMAGED_INSUFFICIENT',
  NOTHING_TO_REVERSE: 'STOCK_NOTHING_TO_REVERSE',
} as const;

export interface StockLine {
  itemId: string;
  bucket?: StockBucket;
  /** Signed: positive in, negative out. */
  quantity: number;
  reason: StockReason;
  /**
   * Incoming on-hand: the known unit cost (purchase). Omitted: the item's average cost, or
   * "unknown" if there is none yet. Damaged bucket: the value it carries (default 0).
   */
  unitCost?: string;
  /** The account on the other side of the inventory value. */
  counterAccount: AccountCode;
  counterParty?: { partyType: PartyType; partyId: string };
  /** Outgoing on-hand that also consumes a reservation (hand-over of held goods). */
  fromReserved?: boolean;
  note?: string;
}

export interface StockRequest {
  sourceType: string;
  sourceId: string;
  event: string;
  actorId: string | null;
  lines: StockLine[];
  entryDate?: string;
  occurredAt?: Date;
}

export interface Balance {
  itemId: string;
  onHand: number;
  reserved: number;
  damaged: number;
  avgCost: string | null;
}

export interface AppliedMovement {
  id: string;
  itemId: string;
  bucket: StockBucket;
  quantity: number;
  unitCost: string;
  costUnknown: boolean;
  value: string;
}

/**
 * The only writer of stock. Inside the caller's transaction it locks the balance rows in item
 * order, checks availability, appends movements, updates the cached balances and posts the
 * cost side to the journal (proposal E, "Inventory transaction model").
 */
@Injectable()
export class StockService implements OnModuleInit {
  private readonly logger = new Logger('Stock');

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly ledger: LedgerService,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit(): void {
    this.jobs.register({
      name: 'stock-balance-check',
      hour: 3,
      run: async () => ({ mismatches: await this.verify() }),
    });
  }

  /** Locks balance rows in item-id order (deadlock-free) and returns them. */
  async lock(tx: Transaction, itemIds: string[]): Promise<Map<string, Balance>> {
    const ids = [...new Set(itemIds)].sort();
    if (ids.length === 0) return new Map();
    await tx
      .insert(itemBalances)
      .values(ids.map((itemId) => ({ itemId })))
      .onConflictDoNothing();
    const rows = await tx
      .select()
      .from(itemBalances)
      .where(inArray(itemBalances.itemId, ids))
      .orderBy(itemBalances.itemId)
      .for('update');
    if (rows.length !== ids.length) throw notFound('Item');
    return new Map(rows.map((r) => [r.itemId, toBalance(r)]));
  }

  async apply(
    tx: Transaction,
    request: StockRequest,
  ): Promise<{ movements: AppliedMovement[]; journalEntryId: string | null }> {
    const balances = await this.lock(
      tx,
      request.lines.map((l) => l.itemId),
    );
    const shortfalls: { itemId: string; requested: number; available: number; bucket: string }[] =
      [];
    const planned: (AppliedMovement & { line: StockLine })[] = [];
    const posting: PostingLine[] = [];

    for (const line of request.lines) {
      const balance = balances.get(line.itemId)!;
      const bucket = line.bucket ?? 'ON_HAND';
      const q = line.quantity;
      let unitCost = '0.0000';
      let costUnknown = false;

      if (bucket === 'ON_HAND') {
        if (q < 0) {
          const need = -q;
          if (line.fromReserved) {
            if (balance.reserved < need || balance.onHand < need) {
              shortfalls.push({
                itemId: line.itemId,
                requested: need,
                available: balance.reserved,
                bucket: 'RESERVED',
              });
              continue;
            }
            balance.reserved -= need;
          } else if (balance.onHand - balance.reserved < need) {
            shortfalls.push({
              itemId: line.itemId,
              requested: need,
              available: balance.onHand - balance.reserved,
              bucket,
            });
            continue;
          }
          unitCost = balance.avgCost ?? '0.0000';
          costUnknown = balance.avgCost === null;
          balance.onHand += q;
        } else {
          const cost = line.unitCost ?? balance.avgCost;
          if (cost === null || cost === undefined) {
            costUnknown = true;
          } else {
            unitCost = Number(cost).toFixed(4);
            balance.avgCost = averageIn(balance.onHand, balance.avgCost, q, unitCost);
          }
          balance.onHand += q;
        }
      } else {
        if (balance.damaged + q < 0) {
          shortfalls.push({
            itemId: line.itemId,
            requested: -q,
            available: balance.damaged,
            bucket,
          });
          continue;
        }
        balance.damaged += q;
        unitCost = Number(line.unitCost ?? '0').toFixed(4);
      }

      const value = valueOf(q, unitCost);
      const valueAccount: AccountCode = bucket === 'ON_HAND' ? 'INVENTORY' : 'DAMAGE_AND_LOSS';
      const party = line.counterParty ?? {};
      if (q > 0)
        posting.push(debit(valueAccount, value), credit(line.counterAccount, value, party));
      else posting.push(debit(line.counterAccount, value, party), credit(valueAccount, value));
      planned.push({
        id: '',
        itemId: line.itemId,
        bucket,
        quantity: q,
        unitCost,
        costUnknown,
        value,
        line,
      });
    }

    if (shortfalls.length) {
      const reserved = shortfalls.every((s) => s.bucket === 'RESERVED');
      throw conflict(
        reserved ? STOCK_ERRORS.RESERVED_INSUFFICIENT : STOCK_ERRORS.INSUFFICIENT,
        'Not enough stock',
        {
          items: shortfalls,
        },
      );
    }

    const journalEntryId = await this.ledger.post(tx, {
      sourceType: request.sourceType,
      sourceId: request.sourceId,
      event: request.event,
      createdBy: request.actorId,
      ...(request.entryDate && { entryDate: request.entryDate }),
      lines: posting,
    });

    const inserted = planned.length
      ? await tx
          .insert(stockMovements)
          .values(
            planned.map((m) => ({
              itemId: m.itemId,
              bucket: m.bucket,
              quantity: m.quantity,
              reason: m.line.reason,
              unitCost: m.unitCost,
              costUnknown: m.costUnknown,
              sourceType: request.sourceType,
              sourceId: request.sourceId,
              journalEntryId,
              note: m.line.note ?? null,
              createdBy: request.actorId,
              ...(request.occurredAt && { occurredAt: request.occurredAt }),
            })),
          )
          .returning({ id: stockMovements.id })
      : [];
    planned.forEach((m, i) => (m.id = inserted[i]!.id));
    await this.saveBalances(tx, balances);
    return { movements: planned.map(({ line: _line, ...m }) => m), journalEntryId };
  }

  /** Raises `reserved` (held goods, confirmed orders). Fails if not available. */
  async reserve(tx: Transaction, lines: { itemId: string; quantity: number }[]): Promise<void> {
    const balances = await this.lock(
      tx,
      lines.map((l) => l.itemId),
    );
    const shortfalls = [];
    for (const line of lines) {
      const b = balances.get(line.itemId)!;
      if (b.onHand - b.reserved < line.quantity) {
        shortfalls.push({
          itemId: line.itemId,
          requested: line.quantity,
          available: b.onHand - b.reserved,
          bucket: 'ON_HAND',
        });
        continue;
      }
      b.reserved += line.quantity;
    }
    if (shortfalls.length)
      throw conflict(STOCK_ERRORS.INSUFFICIENT, 'Not enough stock to reserve', {
        items: shortfalls,
      });
    await this.saveBalances(tx, balances);
  }

  /** Lowers `reserved` without moving stock (a held sale cancelled, an order line dropped). */
  async release(tx: Transaction, lines: { itemId: string; quantity: number }[]): Promise<void> {
    const balances = await this.lock(
      tx,
      lines.map((l) => l.itemId),
    );
    for (const line of lines) {
      const b = balances.get(line.itemId)!;
      if (b.reserved < line.quantity) {
        throw conflict(STOCK_ERRORS.RESERVED_INSUFFICIENT, 'Releasing more than is reserved', {
          itemId: line.itemId,
        });
      }
      b.reserved -= line.quantity;
    }
    await this.saveBalances(tx, balances);
  }

  /**
   * Rule 2 for stock: every active movement of a source gets a mirror movement, the journal
   * entries of that source are reversed, and balances follow. Fails if the stock is gone.
   */
  async reverseSource(
    tx: Transaction,
    sourceType: string,
    sourceId: string,
    actorId: string | null,
    note: string,
  ): Promise<number> {
    const originals = await tx
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.sourceType, sourceType),
          eq(stockMovements.sourceId, sourceId),
          isNull(stockMovements.reversedAt),
          isNull(stockMovements.reversesId),
        ),
      )
      .for('update');
    if (originals.length === 0) return 0;
    const balances = await this.lock(
      tx,
      originals.map((m) => m.itemId),
    );
    for (const m of originals) {
      const b = balances.get(m.itemId)!;
      if (m.bucket === 'ON_HAND') {
        if (m.quantity > 0) {
          if (b.onHand - b.reserved < m.quantity) {
            throw conflict(STOCK_ERRORS.INSUFFICIENT, 'Stock already used; cannot reverse', {
              itemId: m.itemId,
            });
          }
          if (!m.costUnknown) b.avgCost = averageOut(b.onHand, b.avgCost, m.quantity, m.unitCost);
        } else if (!m.costUnknown) {
          b.avgCost = averageIn(b.onHand, b.avgCost, -m.quantity, m.unitCost);
        }
        b.onHand -= m.quantity;
      } else {
        if (b.damaged - m.quantity < 0)
          throw conflict(STOCK_ERRORS.DAMAGED_INSUFFICIENT, 'Damaged stock already written off');
        b.damaged -= m.quantity;
      }
    }
    await tx
      .update(stockMovements)
      .set({ reversedAt: new Date() })
      .where(
        inArray(
          stockMovements.id,
          originals.map((m) => m.id),
        ),
      );
    const journalIds = [
      ...new Set(originals.map((m) => m.journalEntryId).filter((id): id is string => Boolean(id))),
    ];
    const reversalByEntry = new Map<string, string>();
    for (const id of journalIds)
      reversalByEntry.set(id, await this.ledger.reverse(tx, id, actorId, note));
    await tx.insert(stockMovements).values(
      originals.map((m) => ({
        itemId: m.itemId,
        bucket: m.bucket,
        quantity: -m.quantity,
        reason: 'REVERSAL',
        unitCost: m.unitCost,
        costUnknown: m.costUnknown,
        sourceType,
        sourceId,
        journalEntryId: m.journalEntryId ? (reversalByEntry.get(m.journalEntryId) ?? null) : null,
        note,
        createdBy: actorId,
        reversesId: m.id,
      })),
    );
    await this.saveBalances(tx, balances);
    return originals.length;
  }

  async balances(executor: Executor, itemIds: string[]): Promise<Map<string, Balance>> {
    if (itemIds.length === 0) return new Map();
    const rows = await executor
      .select()
      .from(itemBalances)
      .where(inArray(itemBalances.itemId, itemIds));
    const map = new Map(rows.map((r) => [r.itemId, toBalance(r)]));
    for (const id of itemIds)
      if (!map.has(id))
        map.set(id, { itemId: id, onHand: 0, reserved: 0, damaged: 0, avgCost: null });
    return map;
  }

  /**
   * The nightly check: every cached balance must equal the sum of its movements.
   * Returns the items that disagree (expected to be none).
   */
  async verify(executor: Executor = this.db) {
    const rows = await executor.execute<{
      item_id: string;
      on_hand: number;
      damaged: number;
      moved_on_hand: number;
      moved_damaged: number;
    }>(sql`
      select i.id as item_id,
             coalesce(b.on_hand, 0) as on_hand,
             coalesce(b.damaged, 0) as damaged,
             coalesce(sum(m.quantity) filter (where m.bucket = 'ON_HAND'), 0)::int as moved_on_hand,
             coalesce(sum(m.quantity) filter (where m.bucket = 'DAMAGED'), 0)::int as moved_damaged
        from ${items} i
        left join ${itemBalances} b on b.item_id = i.id
        left join ${stockMovements} m on m.item_id = i.id
       group by i.id, b.on_hand, b.damaged
      having coalesce(b.on_hand, 0) <> coalesce(sum(m.quantity) filter (where m.bucket = 'ON_HAND'), 0)
          or coalesce(b.damaged, 0) <> coalesce(sum(m.quantity) filter (where m.bucket = 'DAMAGED'), 0)`);
    const mismatches = [...rows].map((r) => ({
      itemId: r.item_id,
      balance: { onHand: Number(r.on_hand), damaged: Number(r.damaged) },
      movements: { onHand: Number(r.moved_on_hand), damaged: Number(r.moved_damaged) },
    }));
    if (mismatches.length)
      this.logger.error(`Stock balance check: ${mismatches.length} item(s) disagree`);
    return mismatches;
  }

  private async saveBalances(tx: Transaction, balances: Map<string, Balance>): Promise<void> {
    for (const b of balances.values()) {
      await tx
        .update(itemBalances)
        .set({
          onHand: b.onHand,
          reserved: b.reserved,
          damaged: b.damaged,
          avgCost: b.avgCost,
          updatedAt: new Date(),
        })
        .where(eq(itemBalances.itemId, b.itemId));
    }
  }
}

function toBalance(row: typeof itemBalances.$inferSelect): Balance {
  return {
    itemId: row.itemId,
    onHand: row.onHand,
    reserved: row.reserved,
    damaged: row.damaged,
    avgCost: row.avgCost,
  };
}
