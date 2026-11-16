import { sql } from 'drizzle-orm';
import {
  boolean,
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
import { customers, payments, saleSource, sales } from './sales.js';

const money = (name: string) => numeric(name, { precision: 12, scale: 2 });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** A delivery company. What it owes is its balance on COURIER_RECEIVABLES in the ledger. */
export const couriers = pgTable('couriers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  phone: text('phone'),
  note: text('note'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
});

export const orderStatus = pgEnum('order_status', [
  'NEW',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'OUT',
  'COLLECTED',
  'CANCELLED',
  'RETURNED',
]);
export const deliveryMethod = pgEnum('delivery_method', ['COURIER', 'PICKUP']);

/**
 * What a customer asked for. A workflow document, not money or stock: its status moves only
 * along the allowed steps (a trigger checks each one) and every move is an `order_events` row.
 * The sale is created at hand-over and linked here.
 */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: text('number').notNull().unique(),
    source: saleSource('source').notNull(),
    status: orderStatus('status').notNull().default('NEW'),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    delivery: deliveryMethod('delivery').notNull().default('COURIER'),
    courierId: uuid('courier_id').references(() => couriers.id),
    address: text('address'),
    city: text('city'),
    note: text('note'),
    /** Set at hand-over. */
    saleId: uuid('sale_id').references(() => sales.id),
    /** Cash on delivery owed by the courier, fixed when the parcel went out. */
    cod: money('cod').notNull().default('0'),
    cancelReason: text('cancel_reason'),
    version: integer('version').notNull().default(1),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('orders_status_idx').on(t.status, t.createdAt),
    index('orders_customer_idx').on(t.customerId, t.createdAt),
    index('orders_courier_idx')
      .on(t.courierId)
      .where(sql`${t.status} = 'OUT'`),
  ],
);

/** Editable until the order is ready; `reserved` is how many of `quantity` are held for it. */
export const orderLines = pgTable(
  'order_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    position: integer('position').notNull(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),
    quantity: integer('quantity').notNull(),
    /** The price quoted when the order was taken; a later rise becomes a discount at hand-over. */
    unitPrice: money('unit_price').notNull(),
    reserved: integer('reserved').notNull().default(0),
    discount: money('discount').notNull().default('0'),
  },
  (t) => [index('order_lines_order_idx').on(t.orderId)],
);

/** Append-only timeline of an order. */
export const orderEvents = pgTable(
  'order_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    fromStatus: orderStatus('from_status'),
    toStatus: orderStatus('to_status').notNull(),
    note: text('note'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index('order_events_order_idx').on(t.orderId, t.createdAt)],
);

/** Append-only: a courier paying for delivered orders, net of its fee. */
export const courierSettlements = pgTable(
  'courier_settlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: text('number').notNull().unique(),
    courierId: uuid('courier_id')
      .notNull()
      .references(() => couriers.id),
    paymentId: uuid('payment_id').references(() => payments.id),
    received: money('received').notNull(),
    fee: money('fee').notNull().default('0'),
    note: text('note'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index('courier_settlements_courier_idx').on(t.courierId, t.createdAt)],
);

/** Append-only: how much of a settlement went to each order. */
export const courierSettlementLines = pgTable(
  'courier_settlement_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    settlementId: uuid('settlement_id')
      .notNull()
      .references(() => courierSettlements.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    amount: money('amount').notNull(),
  },
  (t) => [index('courier_settlement_lines_order_idx').on(t.orderId)],
);
