import { Injectable } from '@nestjs/common';
import {
  addMoney,
  allocateMoney,
  closePurchaseOrderSchema,
  compareMoney,
  createCreditNoteSchema,
  createPurchaseOrderSchema,
  createReceiptSchema,
  type CreditNoteView,
  fromMinor,
  type ItemCostRow,
  type Page,
  type PurchaseOrderSummary,
  type PurchaseOrderView,
  receiptListQuerySchema,
  type ReceiptSummary,
  type ReceiptView,
  roleCan,
  toMinor,
  type Translatable,
} from '@organza/shared';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Actor } from '../../../common/decorators/auth.decorators.js';
import { badRequest, conflict, forbidden, notFound } from '../../../common/lib/app-error.js';
import { AuditService } from '../../../common/services/audit.service.js';
import { DocumentsService } from '../../../common/services/documents.service.js';
import { IdempotencyService } from '../../../common/services/idempotency.service.js';
import { InjectDb } from '../../../database/database.module.js';
import {
  purchaseOrderLines,
  purchaseOrders,
  supplierAllocations,
  supplierCreditNoteLines,
  supplierCreditNotes,
  supplierReceiptLines,
  supplierReceipts,
  suppliers,
  users,
} from '../../../database/schema/index.js';
import {
  currentTransaction,
  type Database,
  type Executor,
  inTransaction,
  type Transaction,
} from '../../../database/unit-of-work.js';
import { credit, debit, LedgerService } from '../../ledger/services/ledger.service.js';
import { SalesService } from '../../sales/services/sales.service.js';
import { StockService } from '../../stock/services/stock.service.js';
import { neg, PURCHASING_ERRORS, SuppliersService } from './suppliers.service.js';

const ZERO = '0.00';

/** Four-decimal unit cost arithmetic in integer ten-thousandths. */
const toCost = (v: string | number) => Math.round(Number(v) * 10_000);
const fromCost = (units: number) => (units / 10_000).toFixed(4);
/** quantity × unit cost, rounded half-up to cents. */
const extend = (quantity: number, unitCost: string) =>
  fromMinor(Math.round((quantity * toCost(unitCost)) / 100));

/**
 * Spreads extra costs (shipping, customs) over the lines by value, or by quantity when every
 * line is free. Returns each line's landed unit cost and money total; the totals add up to
 * subtotal + extra exactly.
 */
export function landLines(
  lines: { quantity: number; unitCost: string }[],
  extraCosts: string,
): { landedCost: string; lineTotal: string; base: string }[] {
  const base = lines.map((l) => extend(l.quantity, l.unitCost));
  const byValue = base.map((b) => toMinor(b));
  const weights = byValue.some((w) => w > 0) ? byValue : lines.map((l) => l.quantity);
  const shares = allocateMoney(extraCosts, weights);
  return lines.map((l, i) => {
    const share = shares[i] ?? ZERO;
    const landed = toCost(l.unitCost) + Math.round((toMinor(share) * 100) / l.quantity);
    return { base: base[i]!, landedCost: fromCost(landed), lineTotal: addMoney(base[i]!, share) };
  });
}

type CatalogueRow = {
  productId: string;
  name: Translatable;
  variantLabel: Translatable | null;
  sku: string;
};

/**
 * Purchasing (proposal C8): purchase orders (optional), receipts (goods in at cost, owed to the
 * supplier), credit notes (goods back or a price allowance) and cost history. Weighted average
 * cost is kept by the stock service as receipts arrive.
 */
@Injectable()
export class PurchasingService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
    private readonly idempotency: IdempotencyService,
    private readonly ledger: LedgerService,
    private readonly stock: StockService,
    private readonly sales: SalesService,
    private readonly suppliers: SuppliersService,
  ) {}

  private async catalogue(executor: Executor, itemIds: string[]) {
    const map = (await this.sales.catalogueRows(executor, itemIds)) as Map<string, CatalogueRow>;
    const missing = itemIds.filter((id) => !map.has(id));
    if (missing.length)
      throw badRequest(PURCHASING_ERRORS.ITEM_UNKNOWN, 'Unknown items', { items: missing });
    return map;
  }

  // ------------------------------------------------------------------ purchase orders

  async createOrder(
    actor: Actor,
    input: z.output<typeof createPurchaseOrderSchema>,
  ): Promise<PurchaseOrderView> {
    const { result } = await this.idempotency.run(
      'purchasing.order',
      input.idempotencyKey,
      actor.id,
      input,
      async (tx) => {
        const supplier = await this.suppliers.lock(tx, input.supplierId, true);
        await this.catalogue(
          tx,
          input.lines.map((l) => l.itemId),
        );
        const number = await this.documents.next(tx, 'PO');
        const [row] = await tx
          .insert(purchaseOrders)
          .values({
            number,
            supplierId: supplier.id,
            expectedAt: input.expectedAt ?? null,
            note: input.note,
            createdBy: actor.id,
          })
          .returning();
        await tx.insert(purchaseOrderLines).values(
          input.lines.map((l, i) => ({
            purchaseOrderId: row!.id,
            position: i + 1,
            itemId: l.itemId,
            quantity: l.quantity,
            unitCost: l.unitCost,
          })),
        );
        await this.audit.record(tx, {
          userId: actor.id,
          action: 'PURCHASE_ORDER_CREATE',
          entity: 'purchase_order',
          entityId: row!.id,
          newValue: { number, supplierId: supplier.id, lines: input.lines },
        });
        return { id: row!.id };
      },
    );
    return this.order(result.id);
  }

  /** Closes an order short (what arrived is final) or cancels one nothing arrived for. */
  async closeOrder(
    actor: Actor,
    id: string,
    input: z.output<typeof closePurchaseOrderSchema>,
  ): Promise<PurchaseOrderView> {
    await inTransaction(this.db, async (tx) => {
      const [po] = await tx
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, id))
        .for('update');
      if (!po) throw notFound('Purchase order');
      if (po.status !== 'OPEN')
        throw conflict(PURCHASING_ERRORS.ORDER_NOT_OPEN, 'The purchase order is finished');
      if (input.outcome === 'CANCELLED') {
        const [received] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(supplierReceipts)
          .where(eq(supplierReceipts.purchaseOrderId, id));
        if (received!.count > 0)
          throw conflict(PURCHASING_ERRORS.ORDER_HAS_RECEIPTS, 'Goods already arrived; close it');
      }
      await tx
        .update(purchaseOrders)
        .set({ status: input.outcome, closeReason: input.reason, closedAt: new Date() })
        .where(eq(purchaseOrders.id, id));
      await this.audit.record(tx, {
        userId: actor.id,
        action: input.outcome === 'CANCELLED' ? 'PURCHASE_ORDER_CANCEL' : 'PURCHASE_ORDER_CLOSE',
        entity: 'purchase_order',
        entityId: id,
        oldValue: { status: po.status },
        newValue: input,
      });
    });
    return this.order(id);
  }

  async orders(query: {
    supplierId?: string;
    open?: boolean;
    page: number;
    pageSize: number;
  }): Promise<Page<PurchaseOrderSummary>> {
    const where = and(
      query.supplierId ? eq(purchaseOrders.supplierId, query.supplierId) : undefined,
      query.open === undefined
        ? undefined
        : query.open
          ? eq(purchaseOrders.status, 'OPEN')
          : sql`${purchaseOrders.status} <> 'OPEN'`,
    );
    const [rows, [count]] = await Promise.all([
      this.db
        .select({
          po: purchaseOrders,
          supplierName: suppliers.name,
          total: sql<string>`coalesce((select sum(round(l.quantity * l.unit_cost, 2)) from purchase_order_lines l where l.purchase_order_id = ${sql.raw('purchase_orders.id')}), 0)::text`,
          ordered: sql<number>`coalesce((select sum(l.quantity) from purchase_order_lines l where l.purchase_order_id = ${sql.raw('purchase_orders.id')}), 0)::int`,
          received: sql<number>`coalesce((select sum(rl.quantity) from supplier_receipt_lines rl join purchase_order_lines l on l.id = rl.purchase_order_line_id where l.purchase_order_id = ${sql.raw('purchase_orders.id')}), 0)::int`,
        })
        .from(purchaseOrders)
        .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
        .where(where)
        .orderBy(desc(purchaseOrders.createdAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(purchaseOrders)
        .where(where),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.po.id,
        number: r.po.number,
        supplier: { id: r.po.supplierId, name: r.supplierName },
        status: r.po.status,
        expectedAt: r.po.expectedAt,
        total: addMoney(r.total),
        ordered: r.ordered,
        received: r.received,
        createdAt: r.po.createdAt.toISOString(),
      })),
      total: count?.n ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async order(id: string, executor: Executor = currentTransaction() ?? this.db) {
    const [row] = await executor
      .select({ po: purchaseOrders, supplierName: suppliers.name, by: users.name })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
      .innerJoin(users, eq(users.id, purchaseOrders.createdBy))
      .where(eq(purchaseOrders.id, id));
    if (!row) throw notFound('Purchase order');
    const lines = await this.orderLines(executor, id);
    const catalogue = await this.catalogue(
      executor,
      lines.map((l) => l.itemId),
    );
    const receipts = await executor
      .select({
        id: supplierReceipts.id,
        number: supplierReceipts.number,
        createdAt: supplierReceipts.createdAt,
      })
      .from(supplierReceipts)
      .where(eq(supplierReceipts.purchaseOrderId, id))
      .orderBy(asc(supplierReceipts.createdAt));
    const view: PurchaseOrderView = {
      id: row.po.id,
      number: row.po.number,
      supplier: { id: row.po.supplierId, name: row.supplierName },
      status: row.po.status,
      expectedAt: row.po.expectedAt,
      note: row.po.note,
      total: addMoney(ZERO, ...lines.map((l) => extend(l.quantity, l.unitCost))),
      lines: lines.map((l) => {
        const c = catalogue.get(l.itemId)!;
        return {
          id: l.id,
          itemId: l.itemId,
          productId: c.productId,
          name: c.name,
          variantLabel: c.variantLabel,
          sku: c.sku,
          quantity: l.quantity,
          unitCost: l.unitCost,
          received: l.received,
          open: Math.max(0, l.quantity - l.received),
        };
      }),
      receipts: receipts.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      closeReason: row.po.closeReason,
      createdAt: row.po.createdAt.toISOString(),
      createdBy: row.by,
    };
    return view;
  }

  private orderLines(executor: Executor, purchaseOrderId: string) {
    return executor
      .select({
        id: purchaseOrderLines.id,
        itemId: purchaseOrderLines.itemId,
        quantity: purchaseOrderLines.quantity,
        unitCost: purchaseOrderLines.unitCost,
        received: sql<number>`coalesce((select sum(rl.quantity) from supplier_receipt_lines rl where rl.purchase_order_line_id = ${sql.raw('purchase_order_lines.id')}), 0)::int`,
      })
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.purchaseOrderId, purchaseOrderId))
      .orderBy(asc(purchaseOrderLines.position));
  }

  // ------------------------------------------------------------------ receipts

  /**
   * Goods arrived. Stock rises at landed cost (Dr Inventory), the supplier is owed the total
   * (Cr Supplier payables); paid now, the payment settles it. Credit waiting from earlier
   * payments or credit notes is used on it.
   */
  async receive(actor: Actor, input: z.output<typeof createReceiptSchema>): Promise<ReceiptView> {
    if (input.payment && !roleCan(actor.role, 'suppliers.pay'))
      throw forbidden(PURCHASING_ERRORS.PAY_NOT_ALLOWED, 'Paying suppliers needs a manager');
    const { result } = await this.idempotency.run(
      'purchasing.receive',
      input.idempotencyKey,
      actor.id,
      input,
      async (tx) => {
        const supplier = await this.suppliers.lock(tx, input.supplierId, true);
        await this.catalogue(
          tx,
          input.lines.map((l) => l.itemId),
        );
        const linked = await this.matchOrder(tx, supplier.id, input);
        const landed = landLines(input.lines, input.extraCosts);
        const subtotal = addMoney(ZERO, ...landed.map((l) => l.base));
        const total = addMoney(subtotal, input.extraCosts);
        const number = await this.documents.next(tx, 'RCV');
        const [row] = await tx
          .insert(supplierReceipts)
          .values({
            number,
            supplierId: supplier.id,
            purchaseOrderId: input.purchaseOrderId ?? null,
            supplierRef: input.supplierRef,
            note: input.note,
            subtotal,
            extraCosts: input.extraCosts,
            total,
            createdBy: actor.id,
          })
          .returning();
        await tx.insert(supplierReceiptLines).values(
          input.lines.map((l, i) => ({
            receiptId: row!.id,
            position: i + 1,
            itemId: l.itemId,
            purchaseOrderLineId: linked[i] ?? null,
            quantity: l.quantity,
            unitCost: l.unitCost,
            landedCost: landed[i]!.landedCost,
            lineTotal: landed[i]!.lineTotal,
          })),
        );
        const party = { partyType: 'SUPPLIER' as const, partyId: supplier.id };
        const today = await this.ledger.today(tx);
        const { movements } = await this.stock.apply(tx, {
          sourceType: 'supplier_receipt',
          sourceId: row!.id,
          event: 'PURCHASE_RECEIVED',
          actorId: actor.id,
          entryDate: today,
          lines: input.lines.map((l, i) => ({
            itemId: l.itemId,
            quantity: l.quantity,
            reason: 'PURCHASE_RECEIVED' as const,
            unitCost: landed[i]!.landedCost,
            counterAccount: 'SUPPLIER_PAYABLES' as const,
            counterParty: party,
          })),
        });
        // Four-decimal unit costs can leave a few cents between the stock value and the bill;
        // the supplier is owed the bill exactly and the cents go to cost of goods.
        const stocked = addMoney(ZERO, ...movements.map((m) => m.value));
        const diff = addMoney(total, neg(stocked));
        if (compareMoney(diff, 0) !== 0)
          await this.ledger.post(tx, {
            sourceType: 'supplier_receipt',
            sourceId: row!.id,
            event: 'PURCHASE_ROUNDING',
            createdBy: actor.id,
            entryDate: today,
            lines:
              compareMoney(diff, 0) > 0
                ? [debit('COGS', diff), credit('SUPPLIER_PAYABLES', diff, party)]
                : [debit('SUPPLIER_PAYABLES', neg(diff), party), credit('COGS', neg(diff))],
          });
        if (input.purchaseOrderId) await this.closeIfComplete(tx, input.purchaseOrderId);
        if (input.payment) {
          const payment = await this.suppliers.recordPayment(tx, actor, supplier, {
            direction: 'OUT',
            payment: input.payment,
            shiftId: input.shiftId,
            label: number,
          });
          await this.suppliers.allocate(
            tx,
            supplier.id,
            { paymentId: payment.id },
            payment.amountDefault,
            [{ receiptId: row!.id, amount: minMoney(payment.amountDefault, total) }],
          );
        }
        await this.suppliers.applyFreeCredit(tx, supplier.id);
        await this.audit.record(tx, {
          userId: actor.id,
          action: 'PURCHASE_RECEIVE',
          entity: 'supplier_receipt',
          entityId: row!.id,
          newValue: { number, supplierId: supplier.id, total, lines: input.lines },
        });
        return { id: row!.id };
      },
    );
    return this.receipt(result.id);
  }

  /** Links each received line to an open line of the purchase order with the same item. */
  private async matchOrder(
    tx: Transaction,
    supplierId: string,
    input: z.output<typeof createReceiptSchema>,
  ): Promise<(string | null)[]> {
    if (!input.purchaseOrderId) return input.lines.map(() => null);
    const [po] = await tx
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, input.purchaseOrderId))
      .for('update');
    if (!po) throw notFound('Purchase order');
    if (po.supplierId !== supplierId)
      throw conflict(PURCHASING_ERRORS.ORDER_NOT_THEIRS, 'The order is for another supplier');
    if (po.status !== 'OPEN')
      throw conflict(PURCHASING_ERRORS.ORDER_NOT_OPEN, 'The purchase order is finished');
    const lines = await this.orderLines(tx, po.id);
    const open = new Map(lines.map((l) => [l.id, l.quantity - l.received]));
    return input.lines.map((l) => {
      const same = lines.filter((o) => o.itemId === l.itemId);
      const target = same.find((o) => (open.get(o.id) ?? 0) > 0) ?? same[0];
      if (!target) return null;
      open.set(target.id, (open.get(target.id) ?? 0) - l.quantity);
      return target.id;
    });
  }

  private async closeIfComplete(tx: Transaction, purchaseOrderId: string) {
    const lines = await this.orderLines(tx, purchaseOrderId);
    if (lines.every((l) => l.received >= l.quantity))
      await tx
        .update(purchaseOrders)
        .set({ status: 'CLOSED', closedAt: new Date() })
        .where(and(eq(purchaseOrders.id, purchaseOrderId), eq(purchaseOrders.status, 'OPEN')));
  }

  async receipts(query: z.output<typeof receiptListQuerySchema>): Promise<Page<ReceiptSummary>> {
    const settled = sql`coalesce((select sum(a.amount) from supplier_allocations a where a.receipt_id = ${sql.raw('supplier_receipts.id')}), 0)`;
    const where = and(
      query.supplierId ? eq(supplierReceipts.supplierId, query.supplierId) : undefined,
      query.open === undefined
        ? undefined
        : query.open
          ? sql`${supplierReceipts.total} > ${settled}`
          : sql`${supplierReceipts.total} <= ${settled}`,
    );
    const [rows, [count]] = await Promise.all([
      this.db
        .select({
          r: supplierReceipts,
          supplierName: suppliers.name,
          paid: sql<string>`${settled}::text`,
          itemCount: sql<number>`coalesce((select sum(l.quantity) from supplier_receipt_lines l where l.receipt_id = ${sql.raw('supplier_receipts.id')}), 0)::int`,
        })
        .from(supplierReceipts)
        .innerJoin(suppliers, eq(suppliers.id, supplierReceipts.supplierId))
        .where(where)
        .orderBy(desc(supplierReceipts.createdAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(supplierReceipts)
        .where(where),
    ]);
    return {
      items: rows.map((x) => ({
        id: x.r.id,
        number: x.r.number,
        supplier: { id: x.r.supplierId, name: x.supplierName },
        supplierRef: x.r.supplierRef,
        total: addMoney(x.r.total),
        paid: addMoney(x.paid),
        open: addMoney(x.r.total, neg(addMoney(x.paid))),
        itemCount: x.itemCount,
        createdAt: x.r.createdAt.toISOString(),
      })),
      total: count?.n ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async receipt(id: string, executor: Executor = currentTransaction() ?? this.db) {
    const [row] = await executor
      .select({
        r: supplierReceipts,
        supplierName: suppliers.name,
        by: users.name,
        poNumber: purchaseOrders.number,
        paid: sql<string>`coalesce((select sum(a.amount) from supplier_allocations a where a.receipt_id = ${sql.raw('supplier_receipts.id')}), 0)::text`,
      })
      .from(supplierReceipts)
      .innerJoin(suppliers, eq(suppliers.id, supplierReceipts.supplierId))
      .innerJoin(users, eq(users.id, supplierReceipts.createdBy))
      .leftJoin(purchaseOrders, eq(purchaseOrders.id, supplierReceipts.purchaseOrderId))
      .where(eq(supplierReceipts.id, id));
    if (!row) throw notFound('Receipt');
    const lines = await executor
      .select()
      .from(supplierReceiptLines)
      .where(eq(supplierReceiptLines.receiptId, id))
      .orderBy(asc(supplierReceiptLines.position));
    const returned = await this.returnedOn(executor, id);
    const catalogue = await this.catalogue(
      executor,
      lines.map((l) => l.itemId),
    );
    const view: ReceiptView = {
      id: row.r.id,
      number: row.r.number,
      supplier: { id: row.r.supplierId, name: row.supplierName },
      purchaseOrder:
        row.r.purchaseOrderId && row.poNumber
          ? { id: row.r.purchaseOrderId, number: row.poNumber }
          : null,
      supplierRef: row.r.supplierRef,
      note: row.r.note,
      subtotal: addMoney(row.r.subtotal),
      extraCosts: addMoney(row.r.extraCosts),
      total: addMoney(row.r.total),
      paid: addMoney(row.paid),
      open: addMoney(row.r.total, neg(addMoney(row.paid))),
      lines: lines.map((l) => {
        const c = catalogue.get(l.itemId)!;
        // Returned pieces are counted against the first lines of the item.
        const back = Math.min(returned.get(l.itemId) ?? 0, l.quantity);
        returned.set(l.itemId, (returned.get(l.itemId) ?? 0) - back);
        return {
          id: l.id,
          itemId: l.itemId,
          productId: c.productId,
          name: c.name,
          variantLabel: c.variantLabel,
          sku: c.sku,
          quantity: l.quantity,
          unitCost: l.unitCost,
          landedCost: l.landedCost,
          lineTotal: addMoney(l.lineTotal),
          returned: back,
        };
      }),
      createdAt: row.r.createdAt.toISOString(),
      createdBy: row.by,
    };
    return view;
  }

  /** Pieces sent back against a receipt, by item. */
  private async returnedOn(executor: Executor, receiptId: string) {
    const rows = await executor
      .select({
        itemId: supplierCreditNoteLines.itemId,
        quantity: sql<number>`sum(${supplierCreditNoteLines.quantity})::int`,
      })
      .from(supplierCreditNoteLines)
      .innerJoin(
        supplierCreditNotes,
        eq(supplierCreditNotes.id, supplierCreditNoteLines.creditNoteId),
      )
      .where(eq(supplierCreditNotes.receiptId, receiptId))
      .groupBy(supplierCreditNoteLines.itemId);
    return new Map(rows.map((r) => [r.itemId, r.quantity]));
  }

  // ------------------------------------------------------------------ credit notes

  /**
   * Lowers what is owed. RETURN: the pieces leave stock at their cost (to Damage and loss) and
   * the supplier credits them (from Damage and loss), so only a difference stays as a loss or
   * gain. ALLOWANCE: a price reduction on goods already in, credited to cost of goods.
   */
  async creditNote(
    actor: Actor,
    input: z.output<typeof createCreditNoteSchema>,
  ): Promise<CreditNoteView> {
    const { result } = await this.idempotency.run(
      'purchasing.credit',
      input.idempotencyKey,
      actor.id,
      input,
      async (tx) => {
        const supplier = await this.suppliers.lock(tx, input.supplierId);
        let receiptNumber: string | null = null;
        if (input.receiptId) {
          const [r] = await tx
            .select()
            .from(supplierReceipts)
            .where(eq(supplierReceipts.id, input.receiptId));
          if (!r || r.supplierId !== supplier.id)
            throw conflict(PURCHASING_ERRORS.RECEIPT_NOT_THEIRS, 'Not a receipt of the supplier');
          receiptNumber = r.number;
        }
        const lines = input.kind === 'RETURN' ? input.lines : [];
        if (lines.length) {
          await this.catalogue(
            tx,
            lines.map((l) => l.itemId),
          );
          if (input.receiptId) await this.checkReturnable(tx, input.receiptId, lines);
        }
        const amount =
          input.kind === 'RETURN'
            ? addMoney(ZERO, ...lines.map((l) => extend(l.quantity, l.unitCredit)))
            : addMoney(input.amount ?? ZERO);
        if (compareMoney(amount, 0) <= 0)
          throw badRequest('CREDIT_NOTE_EMPTY', 'The credit note is for nothing');
        const number = await this.documents.next(tx, 'SCN');
        const [row] = await tx
          .insert(supplierCreditNotes)
          .values({
            number,
            supplierId: supplier.id,
            kind: input.kind,
            receiptId: input.receiptId ?? null,
            supplierRef: input.supplierRef,
            reason: input.reason,
            amount,
            createdBy: actor.id,
          })
          .returning();
        const today = await this.ledger.today(tx);
        const party = { partyType: 'SUPPLIER' as const, partyId: supplier.id };
        if (lines.length) {
          await tx.insert(supplierCreditNoteLines).values(
            lines.map((l) => ({
              creditNoteId: row!.id,
              itemId: l.itemId,
              quantity: l.quantity,
              unitCredit: l.unitCredit,
              fromDamaged: l.fromDamaged,
            })),
          );
          await this.stock.apply(tx, {
            sourceType: 'supplier_credit_note',
            sourceId: row!.id,
            event: 'SUPPLIER_RETURN',
            actorId: actor.id,
            entryDate: today,
            lines: lines.map((l) => ({
              itemId: l.itemId,
              bucket: l.fromDamaged ? ('DAMAGED' as const) : ('ON_HAND' as const),
              quantity: -l.quantity,
              reason: 'SUPPLIER_RETURN' as const,
              counterAccount: 'DAMAGE_AND_LOSS' as const,
              note: number,
            })),
          });
        }
        await this.ledger.post(tx, {
          sourceType: 'supplier_credit_note',
          sourceId: row!.id,
          event: input.kind === 'RETURN' ? 'SUPPLIER_RETURN_CREDIT' : 'SUPPLIER_ALLOWANCE',
          createdBy: actor.id,
          entryDate: today,
          lines: [
            debit('SUPPLIER_PAYABLES', amount, party),
            credit(input.kind === 'RETURN' ? 'DAMAGE_AND_LOSS' : 'COGS', amount),
          ],
        });
        // Settles the receipt it corrects first, then the oldest open ones.
        if (input.receiptId) {
          const open = (await this.suppliers.openReceipts(tx, supplier.id)).find(
            (o) => o.id === input.receiptId,
          );
          if (open)
            await tx.insert(supplierAllocations).values({
              receiptId: open.id,
              creditNoteId: row!.id,
              amount: minMoney(open.open, amount),
            });
        }
        await this.suppliers.applyFreeCredit(tx, supplier.id);
        await this.audit.record(tx, {
          userId: actor.id,
          action: 'SUPPLIER_CREDIT_NOTE',
          entity: 'supplier',
          entityId: supplier.id,
          newValue: { number, kind: input.kind, amount, receipt: receiptNumber, lines },
        });
        return { id: row!.id };
      },
    );
    return this.creditNoteView(result.id);
  }

  private async checkReturnable(
    tx: Transaction,
    receiptId: string,
    lines: { itemId: string; quantity: number }[],
  ) {
    const received = await tx
      .select({
        itemId: supplierReceiptLines.itemId,
        quantity: sql<number>`sum(${supplierReceiptLines.quantity})::int`,
      })
      .from(supplierReceiptLines)
      .where(eq(supplierReceiptLines.receiptId, receiptId))
      .groupBy(supplierReceiptLines.itemId);
    const back = await this.returnedOn(tx, receiptId);
    const asked = new Map<string, number>();
    for (const l of lines) asked.set(l.itemId, (asked.get(l.itemId) ?? 0) + l.quantity);
    for (const [itemId, quantity] of asked) {
      const got = received.find((r) => r.itemId === itemId)?.quantity ?? 0;
      if (quantity > got - (back.get(itemId) ?? 0))
        throw conflict(PURCHASING_ERRORS.RETURN_TOO_MANY, 'More than came on that receipt', {
          itemId,
          left: got - (back.get(itemId) ?? 0),
        });
    }
  }

  async creditNotes(supplierId: string): Promise<CreditNoteView[]> {
    const rows = await this.db
      .select({ id: supplierCreditNotes.id })
      .from(supplierCreditNotes)
      .where(eq(supplierCreditNotes.supplierId, supplierId))
      .orderBy(desc(supplierCreditNotes.createdAt))
      .limit(100);
    return Promise.all(rows.map((r) => this.creditNoteView(r.id)));
  }

  async creditNoteView(id: string, executor: Executor = currentTransaction() ?? this.db) {
    const [row] = await executor
      .select({
        c: supplierCreditNotes,
        supplierName: suppliers.name,
        by: users.name,
        receiptNumber: supplierReceipts.number,
      })
      .from(supplierCreditNotes)
      .innerJoin(suppliers, eq(suppliers.id, supplierCreditNotes.supplierId))
      .innerJoin(users, eq(users.id, supplierCreditNotes.createdBy))
      .leftJoin(supplierReceipts, eq(supplierReceipts.id, supplierCreditNotes.receiptId))
      .where(eq(supplierCreditNotes.id, id));
    if (!row) throw notFound('Credit note');
    const lines = await executor
      .select()
      .from(supplierCreditNoteLines)
      .where(eq(supplierCreditNoteLines.creditNoteId, id));
    const catalogue = lines.length
      ? await this.catalogue(
          executor,
          lines.map((l) => l.itemId),
        )
      : new Map<string, CatalogueRow>();
    const view: CreditNoteView = {
      id: row.c.id,
      number: row.c.number,
      supplier: { id: row.c.supplierId, name: row.supplierName },
      kind: row.c.kind,
      receipt:
        row.c.receiptId && row.receiptNumber
          ? { id: row.c.receiptId, number: row.receiptNumber }
          : null,
      supplierRef: row.c.supplierRef,
      reason: row.c.reason,
      amount: addMoney(row.c.amount),
      lines: lines.map((l) => ({
        itemId: l.itemId,
        name: catalogue.get(l.itemId)!.name,
        sku: catalogue.get(l.itemId)!.sku,
        quantity: l.quantity,
        unitCredit: l.unitCredit,
        fromDamaged: l.fromDamaged,
      })),
      createdAt: row.c.createdAt.toISOString(),
      createdBy: row.by,
    };
    return view;
  }

  // ------------------------------------------------------------------ cost history

  async costHistory(itemId: string): Promise<ItemCostRow[]> {
    const rows = await this.db
      .select({
        receiptId: supplierReceipts.id,
        number: supplierReceipts.number,
        supplierId: suppliers.id,
        supplierName: suppliers.name,
        quantity: supplierReceiptLines.quantity,
        unitCost: supplierReceiptLines.unitCost,
        landedCost: supplierReceiptLines.landedCost,
        createdAt: supplierReceipts.createdAt,
      })
      .from(supplierReceiptLines)
      .innerJoin(supplierReceipts, eq(supplierReceipts.id, supplierReceiptLines.receiptId))
      .innerJoin(suppliers, eq(suppliers.id, supplierReceipts.supplierId))
      .where(eq(supplierReceiptLines.itemId, itemId))
      .orderBy(desc(supplierReceipts.createdAt))
      .limit(100);
    return rows.map((r) => ({
      receiptId: r.receiptId,
      number: r.number,
      supplier: { id: r.supplierId, name: r.supplierName },
      quantity: r.quantity,
      unitCost: r.unitCost,
      landedCost: r.landedCost,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

const minMoney = (a: string, b: string) => (compareMoney(a, b) <= 0 ? a : b);

export const purchaseOrderListQuerySchema = z.object({
  supplierId: z.uuid().optional(),
  open: z.stringbool().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
