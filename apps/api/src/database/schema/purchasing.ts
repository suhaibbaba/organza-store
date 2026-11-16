import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { items } from './catalogue.js';
import { users } from './core.js';
import { payments } from './sales.js';

const money = (name: string) => numeric(name, { precision: 12, scale: 2 });
const cost = (name: string) => numeric(name, { precision: 14, scale: 4 });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const createdBy = () =>
  uuid('created_by')
    .notNull()
    .references(() => users.id);

/** What the shop owes a supplier is its balance on SUPPLIER_PAYABLES in the ledger. */
export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  contactName: text('contact_name'),
  phone: text('phone'),
  address: text('address'),
  note: text('note'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
});

export const purchaseOrderStatus = pgEnum('purchase_order_status', ['OPEN', 'CLOSED', 'CANCELLED']);

/** What was asked of a supplier. Optional; moves no stock and no money. */
export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: text('number').notNull().unique(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    status: purchaseOrderStatus('status').notNull().default('OPEN'),
    expectedAt: date('expected_at'),
    note: text('note'),
    closeReason: text('close_reason'),
    createdBy: createdBy(),
    createdAt: createdAt(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [index('purchase_orders_supplier_idx').on(t.supplierId, t.createdAt)],
);

export const purchaseOrderLines = pgTable(
  'purchase_order_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id),
    position: integer('position').notNull(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),
    quantity: integer('quantity').notNull(),
    unitCost: cost('unit_cost').notNull(),
  },
  (t) => [index('purchase_order_lines_order_idx').on(t.purchaseOrderId)],
);

/**
 * Goods that arrived and what is owed for them (the supplier's invoice). Append-only: stock
 * came in at `landed_cost` and the supplier's balance rose by `total`.
 */
export const supplierReceipts = pgTable(
  'supplier_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: text('number').notNull().unique(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id),
    supplierRef: text('supplier_ref'),
    note: text('note'),
    subtotal: money('subtotal').notNull(),
    extraCosts: money('extra_costs').notNull().default('0'),
    total: money('total').notNull(),
    createdBy: createdBy(),
    createdAt: createdAt(),
  },
  (t) => [index('supplier_receipts_supplier_idx').on(t.supplierId, t.createdAt)],
);

export const supplierReceiptLines = pgTable(
  'supplier_receipt_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    receiptId: uuid('receipt_id')
      .notNull()
      .references(() => supplierReceipts.id),
    position: integer('position').notNull(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),
    purchaseOrderLineId: uuid('purchase_order_line_id').references(() => purchaseOrderLines.id),
    quantity: integer('quantity').notNull(),
    unitCost: cost('unit_cost').notNull(),
    /** Unit cost plus its share of the extra costs: what the stock carries. */
    landedCost: cost('landed_cost').notNull(),
    lineTotal: money('line_total').notNull(),
  },
  (t) => [
    index('supplier_receipt_lines_receipt_idx').on(t.receiptId),
    index('supplier_receipt_lines_item_idx').on(t.itemId),
  ],
);

export const creditNoteKind = pgEnum('supplier_credit_note_kind', ['RETURN', 'ALLOWANCE']);

/** Lowers what is owed: goods sent back, or a price allowance. Append-only. */
export const supplierCreditNotes = pgTable(
  'supplier_credit_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: text('number').notNull().unique(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    kind: creditNoteKind('kind').notNull(),
    receiptId: uuid('receipt_id').references(() => supplierReceipts.id),
    supplierRef: text('supplier_ref'),
    reason: text('reason').notNull(),
    amount: money('amount').notNull(),
    createdBy: createdBy(),
    createdAt: createdAt(),
  },
  (t) => [index('supplier_credit_notes_supplier_idx').on(t.supplierId, t.createdAt)],
);

export const supplierCreditNoteLines = pgTable(
  'supplier_credit_note_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    creditNoteId: uuid('credit_note_id')
      .notNull()
      .references(() => supplierCreditNotes.id),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),
    quantity: integer('quantity').notNull(),
    unitCredit: cost('unit_credit').notNull(),
    fromDamaged: boolean('from_damaged').notNull().default(false),
  },
  (t) => [index('supplier_credit_note_lines_note_idx').on(t.creditNoteId)],
);

/**
 * Append-only: how much of a payment or a credit note settles each receipt. Exactly one of
 * payment and credit note is set; a receipt is never settled above its total (deferred check).
 */
export const supplierAllocations = pgTable(
  'supplier_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    receiptId: uuid('receipt_id')
      .notNull()
      .references(() => supplierReceipts.id),
    paymentId: uuid('payment_id').references(() => payments.id),
    creditNoteId: uuid('credit_note_id').references(() => supplierCreditNotes.id),
    amount: money('amount').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('supplier_allocations_receipt_idx').on(t.receiptId),
    index('supplier_allocations_payment_idx')
      .on(t.paymentId)
      .where(sql`${t.paymentId} IS NOT NULL`),
    index('supplier_allocations_credit_idx')
      .on(t.creditNoteId)
      .where(sql`${t.creditNoteId} IS NOT NULL`),
  ],
);
