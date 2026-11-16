import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { items, products } from './catalogue.js';
import { users } from './core.js';
import { currencies } from './settings.js';

const money = (name: string) => numeric(name, { precision: 12, scale: 2 });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/**
 * A customer. Debt and credit are never stored here: they are the customer's balances on
 * CUSTOMER_RECEIVABLES and CUSTOMER_CREDIT in the ledger. `phone_key` collapses the +970 and
 * +972 spellings of one Palestinian line so the same person cannot be entered twice; the
 * number itself is kept exactly as entered.
 */
export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    phone: text('phone'),
    phoneKey: text('phone_key'),
    whatsapp: text('whatsapp'),
    address: text('address'),
    city: text('city'),
    notes: text('notes'),
    searchText: text('search_text').notNull().default(''),
    /** Set when merged into another customer; the record stays for history. */
    mergedIntoId: uuid('merged_into_id').references((): AnyPgColumn => customers.id),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('customers_phone_key_uniq')
      .on(t.phoneKey)
      .where(sql`${t.phoneKey} is not null and ${t.mergedIntoId} is null`),
    index('customers_search_idx').using('gin', sql`${t.searchText} gin_trgm_ops`),
  ],
);

/** A till. Each has its own shifts and its own drawer count. */
export const registers = pgTable('registers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
});

/**
 * OPEN: taking sales. LEFT_OPEN: a newer shift was opened on the register on a later day; it
 * takes no more sales and still needs its count. COUNTED: the blind count is in, the expected
 * figure is now visible. CLOSED: drop and float recorded.
 */
export const shiftStatus = pgEnum('shift_status', ['OPEN', 'LEFT_OPEN', 'COUNTED', 'CLOSED']);

export const shifts = pgTable(
  'shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: text('number').notNull().unique(),
    registerId: uuid('register_id')
      .notNull()
      .references(() => registers.id),
    status: shiftStatus('status').notNull().default('OPEN'),
    businessDate: date('business_date').notNull(),
    openedBy: uuid('opened_by')
      .notNull()
      .references(() => users.id),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    openNote: text('open_note'),
    countedBy: uuid('counted_by').references(() => users.id),
    countedAt: timestamp('counted_at', { withTimezone: true }),
    closedBy: uuid('closed_by').references(() => users.id),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closeNote: text('close_note'),
    /** A difference at close stays listed until a manager signs it off. */
    hasDifference: boolean('has_difference').notNull().default(false),
    signedOffBy: uuid('signed_off_by').references(() => users.id),
    signedOffAt: timestamp('signed_off_at', { withTimezone: true }),
    signOffNote: text('sign_off_note'),
    /** Imported from the old system: read-only history, figures as the old system froze them. */
    imported: boolean('imported').notNull().default(false),
    /** The old cash session's own figures (opening, cash sales, expenses, counted, withdrawn). */
    legacy: jsonb('legacy'),
  },
  (t) => [
    uniqueIndex('shifts_one_open_per_register')
      .on(t.registerId)
      .where(sql`${t.status} = 'OPEN'`),
    index('shifts_register_idx').on(t.registerId, t.openedAt),
  ],
);

export const shiftCountKind = pgEnum('shift_count_kind', ['OPENING', 'CLOSING', 'RECOUNT']);

/** Append-only. One row per currency per count; a recount adds rows, both stay. */
export const shiftCounts = pgTable(
  'shift_counts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => shifts.id),
    kind: shiftCountKind('kind').notNull(),
    currency: char('currency', { length: 3 })
      .notNull()
      .references(() => currencies.code),
    amount: money('amount').notNull(),
    /** What the system expected at that moment (stored with the count, shown only after). */
    expected: money('expected').notNull(),
    denominations: jsonb('denominations'),
    countedBy: uuid('counted_by')
      .notNull()
      .references(() => users.id),
    countedAt: timestamp('counted_at', { withTimezone: true }).notNull().defaultNow(),
    note: text('note'),
  },
  (t) => [index('shift_counts_shift_idx').on(t.shiftId, t.kind)],
);

export const cashMovementType = pgEnum('cash_movement_type', [
  /** Cash put into the drawer from the safe or bank. */
  'PAID_IN',
  /** Cash taken out to the safe or bank (a drop), including the drop at close. */
  'DROP',
  /** Cash paid out for a shop expense. */
  'EXPENSE',
]);

/** Append-only drawer movement that is not a customer payment. */
export const cashMovements = pgTable(
  'cash_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: text('number').notNull().unique(),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => shifts.id),
    type: cashMovementType('type').notNull(),
    currency: char('currency', { length: 3 })
      .notNull()
      .references(() => currencies.code),
    /** In `currency`, always positive; the type says the direction. */
    amount: money('amount').notNull(),
    rate: numeric('rate', { precision: 14, scale: 6 }).notNull(),
    amountDefault: money('amount_default').notNull(),
    /** SAFE or BANK for paid-in and drops; the expense category for expenses. */
    counterpart: text('counterpart').notNull(),
    note: text('note'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    reversesId: uuid('reverses_id').references((): AnyPgColumn => cashMovements.id),
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
  },
  (t) => [index('cash_movements_shift_idx').on(t.shiftId)],
);

export const saleSource = pgEnum('sale_source', ['COUNTER', 'WHATSAPP', 'ONLINE', 'PHONE']);
export const fulfilmentMode = pgEnum('fulfilment_mode', ['TAKEN', 'HELD']);
/**
 * COMPLETED: final; money and stock posted. CANCELLED: a held sale cancelled before hand-over.
 * VOIDED: a completed sale reversed by a manager (phase 3).
 */
export const saleStatus = pgEnum('sale_status', ['COMPLETED', 'CANCELLED', 'VOIDED']);
export const fulfilmentStatus = pgEnum('fulfilment_status', ['FULFILLED', 'HELD', 'PARTLY_HANDED']);

/** One document for every channel (proposal C4). Payment state is derived from allocations. */
export const sales = pgTable(
  'sales',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: text('number').notNull().unique(),
    source: saleSource('source').notNull().default('COUNTER'),
    status: saleStatus('status').notNull().default('COMPLETED'),
    fulfilmentMode: fulfilmentMode('fulfilment_mode').notNull().default('TAKEN'),
    fulfilmentStatus: fulfilmentStatus('fulfilment_status').notNull().default('FULFILLED'),
    customerId: uuid('customer_id').references(() => customers.id),
    shiftId: uuid('shift_id').references(() => shifts.id),
    businessDate: date('business_date').notNull(),
    /** Before discounts. */
    subtotal: money('subtotal').notNull(),
    discountTotal: money('discount_total').notNull().default('0'),
    total: money('total').notNull(),
    note: text('note'),
    /** Imported from the old system: shown in history, never posted to the ledger. */
    imported: boolean('imported').notNull().default(false),
    /** The value of the lines returned so far; what is due is total minus this. */
    returnedTotal: money('returned_total').notNull().default('0'),
    /** A gift purchase: the gift receipt prints without prices. */
    giftReceipt: boolean('gift_receipt').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: createdAt(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledBy: uuid('cancelled_by').references(() => users.id),
    cancelReason: text('cancel_reason'),
    cancelOutcome: text('cancel_outcome'),
  },
  (t) => [
    index('sales_customer_idx').on(t.customerId, t.createdAt),
    index('sales_shift_idx').on(t.shiftId),
    index('sales_date_idx').on(t.businessDate),
    index('sales_held_idx')
      .on(t.createdAt)
      .where(sql`${t.fulfilmentStatus} in ('HELD','PARTLY_HANDED') and ${t.status} = 'COMPLETED'`),
  ],
);

export const saleLines = pgTable(
  'sale_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id),
    position: integer('position').notNull(),
    itemId: uuid('item_id').references(() => items.id),
    productId: uuid('product_id').references(() => products.id),
    /** Snapshots: what the receipt said, whatever happens to the product later. */
    name: jsonb('name').notNull(),
    variantLabel: jsonb('variant_label'),
    sku: text('sku'),
    quantity: integer('quantity').notNull(),
    unitPrice: money('unit_price').notNull(),
    /** Line discount plus this line's share of a cart discount. */
    discount: money('discount').notNull().default('0'),
    lineTotal: money('line_total').notNull(),
    unitCost: numeric('unit_cost', { precision: 14, scale: 4 }),
    costUnknown: boolean('cost_unknown').notNull().default(false),
    handedOver: integer('handed_over').notNull().default(0),
    /** Pieces brought back by returns, exchanges or a void. */
    returned: integer('returned').notNull().default(0),
    /** A giveaway: free to the customer, its cost booked as a promotion. */
    giveaway: boolean('giveaway').notNull().default(false),
  },
  (t) => [index('sale_lines_sale_idx').on(t.saleId), index('sale_lines_item_idx').on(t.itemId)],
);

/** A held sale's goods given to the customer (all or part). */
export const saleHandovers = pgTable(
  'sale_handovers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id),
    /** The value of the goods handed over: the revenue this hand-over recognises. */
    value: money('value').notNull(),
    /** The part of `value` paid by the deposit; the rest became debt. */
    depositApplied: money('deposit_applied').notNull(),
    lines: jsonb('lines').notNull(),
    owedAcknowledged: boolean('owed_acknowledged').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index('sale_handovers_sale_idx').on(t.saleId)],
);

export const paymentDirection = pgEnum('payment_direction', ['IN', 'OUT']);
export const paymentMethod = pgEnum('payment_method', [
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'STORE_CREDIT',
  'COURIER',
  'SAFE',
]);

/**
 * Money received or paid back. Append-only; a correction is a reversing payment. Each stores
 * its currency, the amount in it and the rate used; `amount_default` is what the ledger saw.
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: text('number').notNull().unique(),
    direction: paymentDirection('direction').notNull(),
    method: paymentMethod('method').notNull(),
    currency: char('currency', { length: 3 })
      .notNull()
      .references(() => currencies.code),
    amount: money('amount').notNull(),
    rate: numeric('rate', { precision: 14, scale: 6 }).notNull(),
    amountDefault: money('amount_default').notNull(),
    reference: text('reference'),
    customerId: uuid('customer_id').references(() => customers.id),
    shiftId: uuid('shift_id').references(() => shifts.id),
    /** COURIER payments: the delivery company that owes this cash on delivery. */
    courierId: uuid('courier_id'),
    /** Paid to (or refunded by) a supplier. */
    supplierId: uuid('supplier_id'),
    /** A deposit taken for an order before hand-over. */
    orderId: uuid('order_id'),
    /** The sale this money was taken or given back at, if any (context; allocations pay). */
    saleId: uuid('sale_id').references((): AnyPgColumn => sales.id),
    /** CHANGE: cash given back at the counter for an over-tender. */
    purpose: text('purpose').notNull().default('PAYMENT'),
    note: text('note'),
    businessDate: date('business_date').notNull(),
    takenBy: uuid('taken_by')
      .notNull()
      .references(() => users.id),
    takenAt: timestamp('taken_at', { withTimezone: true }).notNull().defaultNow(),
    reversesId: uuid('reverses_id').references((): AnyPgColumn => payments.id),
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    /** Imported from the old system: history only, never posted to the ledger. */
    imported: boolean('imported').notNull().default(false),
  },
  (t) => [
    index('payments_customer_idx').on(t.customerId, t.takenAt),
    index('payments_shift_idx').on(t.shiftId),
    index('payments_date_idx').on(t.businessDate),
  ],
);

/**
 * Which sale a payment pays, in the default currency. Append-only and signed: releasing an
 * allocation is a negative row pointing at it. A payment's unallocated part is customer credit.
 */
export const paymentAllocations = pgTable(
  'payment_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id),
    amount: money('amount').notNull(),
    reversesId: uuid('reverses_id').references((): AnyPgColumn => paymentAllocations.id),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index('payment_allocations_payment_idx').on(t.paymentId),
    index('payment_allocations_sale_idx').on(t.saleId),
  ],
);

export const returnKind = pgEnum('return_kind', ['RETURN', 'EXCHANGE', 'VOID']);
export const returnCondition = pgEnum('return_condition', ['SHELF', 'DAMAGED']);

/**
 * Goods brought back against a sale's lines (proposal C6). An exchange is the same document
 * with the new sale it paid towards; a void returns everything left on the sale. The value
 * returned first clears what was still owed on the sale; the rest went to the new sale, back
 * to the customer, or to store credit.
 */
export const saleReturns = pgTable(
  'sale_returns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: text('number').notNull().unique(),
    kind: returnKind('kind').notNull(),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id),
    customerId: uuid('customer_id').references(() => customers.id),
    shiftId: uuid('shift_id').references(() => shifts.id),
    businessDate: date('business_date').notNull(),
    value: money('value').notNull(),
    debtReduced: money('debt_reduced').notNull().default('0'),
    toExchange: money('to_exchange').notNull().default('0'),
    refunded: money('refunded').notNull().default('0'),
    refundMethod: paymentMethod('refund_method'),
    toCredit: money('to_credit').notNull().default('0'),
    exchangeSaleId: uuid('exchange_sale_id').references(() => sales.id),
    reason: text('reason').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    /** A manager who approved it in place or from the approvals inbox. */
    approvedBy: uuid('approved_by').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index('sale_returns_sale_idx').on(t.saleId),
    index('sale_returns_shift_idx').on(t.shiftId),
    index('sale_returns_date_idx').on(t.businessDate),
  ],
);

export const saleReturnLines = pgTable(
  'sale_return_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    returnId: uuid('return_id')
      .notNull()
      .references(() => saleReturns.id),
    saleLineId: uuid('sale_line_id')
      .notNull()
      .references(() => saleLines.id),
    itemId: uuid('item_id').references(() => items.id),
    quantity: integer('quantity').notNull(),
    condition: returnCondition('condition').notNull(),
    /** Price times quantity, the discount share, and what the customer had paid for them. */
    gross: money('gross').notNull(),
    discount: money('discount').notNull(),
    value: money('value').notNull(),
  },
  (t) => [index('sale_return_lines_return_idx').on(t.returnId)],
);
