import { z } from 'zod';
import type { Translatable } from './common.js';
import {
  idempotencyKeySchema,
  nonNegativeMoneySchema,
  paginationSchema,
  positiveMoneySchema,
  uuidSchema,
} from './common.js';
import {
  paymentInputSchema,
  RETURN_CONDITIONS,
  SALE_SOURCES,
  type PaymentView,
  type SaleSource,
} from './sales.js';

/**
 * Orders and fulfilment (proposal C7). An order is what a customer asked for, kept apart from
 * the sale: confirming reserves stock, and hand-over (to a courier or to the customer at the
 * counter) turns it into a sale, which is when revenue is recognised.
 */
export const ORDER_STATUSES = [
  'NEW',
  'CONFIRMED',
  'PREPARING',
  'READY',
  /** Handed to a delivery company. */
  'OUT',
  /** Collected by the customer at the shop. */
  'COLLECTED',
  'CANCELLED',
  /** A parcel the customer refused, back at the shop. */
  'RETURNED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** The board's columns, in order; the rest are finished. */
export const OPEN_ORDER_STATUSES = ['NEW', 'CONFIRMED', 'PREPARING', 'READY'] as const;

/** Which status each step moves from; the server applies it only from there (no double click). */
export const ORDER_STEPS = {
  confirm: ['NEW'],
  prepare: ['CONFIRMED'],
  ready: ['PREPARING'],
  ship: ['READY'],
  collect: ['READY'],
  cancel: ['NEW', 'CONFIRMED', 'PREPARING', 'READY'],
  returned: ['OUT'],
} as const satisfies Record<string, readonly OrderStatus[]>;
export type OrderStep = keyof typeof ORDER_STEPS;

/** Lines can change until the order is ready; after that only cancel or return. */
export const EDITABLE_ORDER_STATUSES: readonly OrderStatus[] = ['NEW', 'CONFIRMED', 'PREPARING'];

export const DELIVERY_METHODS = ['COURIER', 'PICKUP'] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const orderLineInputSchema = z.object({
  itemId: uuidSchema,
  quantity: z.number().int().min(1).max(100),
  /** Line discount in the default currency. */
  discount: nonNegativeMoneySchema.default('0.00'),
});

export const createOrderSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  source: z.enum(SALE_SOURCES).default('WHATSAPP'),
  customerId: uuidSchema,
  delivery: z.enum(DELIVERY_METHODS).default('COURIER'),
  courierId: uuidSchema.optional(),
  address: optionalText(300),
  city: optionalText(100),
  note: optionalText(500),
  lines: z.array(orderLineInputSchema).min(1).max(100),
  /** The same customer, items and day was already ordered; true saves it anyway. */
  confirmDuplicate: z.boolean().default(false),
});
export type CreateOrderInput = z.input<typeof createOrderSchema>;

export const updateOrderSchema = z.object({
  version: z.number().int().min(1),
  delivery: z.enum(DELIVERY_METHODS).optional(),
  courierId: uuidSchema.nullable().optional(),
  address: optionalText(300),
  city: optionalText(100),
  note: optionalText(500),
  /** The whole new set of lines (until ready); reservations follow. */
  lines: z.array(orderLineInputSchema).min(1).max(100).optional(),
});
export type UpdateOrderInput = z.input<typeof updateOrderSchema>;

/** A step applies only from its own status; repeating it (a double click) changes nothing. */
export const orderStepSchema = z.object({
  note: optionalText(500),
});

export const cancelOrderSchema = orderStepSchema.extend({
  reason: z.string().trim().min(3).max(500),
});

/** Money taken before hand-over: kept as the customer's credit and used at hand-over. */
export const orderDepositSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  shiftId: uuidSchema.optional(),
  payment: paymentInputSchema.refine((p) => p.method !== 'STORE_CREDIT', 'NOT_STORE_CREDIT'),
});

/** Handed to the courier: what is still due is cash on delivery, owed by the company. */
export const shipOrderSchema = orderStepSchema.extend({
  idempotencyKey: idempotencyKeySchema,
  courierId: uuidSchema.optional(),
  /** Needed only for an order typed in at the counter. */
  shiftId: uuidSchema.optional(),
});

/** Collected at the shop: paid now, or left as debt. */
export const collectOrderSchema = orderStepSchema.extend({
  idempotencyKey: idempotencyKeySchema,
  shiftId: uuidSchema.optional(),
  payments: z.array(paymentInputSchema).max(10).default([]),
  overpayment: z.enum(['CHANGE', 'CREDIT']).default('CHANGE'),
});

/** A parcel came back: each line to the shelf or damaged; the courier no longer owes it. */
export const returnedOrderSchema = orderStepSchema.extend({
  idempotencyKey: idempotencyKeySchema,
  shiftId: uuidSchema.optional(),
  reason: z.string().trim().min(3).max(500),
  lines: z
    .array(z.object({ lineId: uuidSchema, condition: z.enum(RETURN_CONDITIONS) }))
    .max(100)
    .default([]),
});

export const orderListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  /** Every status not yet finished (the board). */
  open: z.stringbool().optional(),
  source: z.enum(SALE_SOURCES).optional(),
  courierId: uuidSchema.optional(),
  customerId: uuidSchema.optional(),
  /** Out with a courier and not fully settled. */
  unsettled: z.stringbool().optional(),
});

export interface OrderLineView {
  id: string;
  itemId: string;
  productId: string;
  name: Translatable;
  variantLabel: Translatable | null;
  sku: string;
  imageUrl: string | null;
  location: string | null;
  quantity: number;
  reserved: number;
  /** Quoted when the order was taken. */
  unitPrice: string;
  /** Today's catalogue price; above the quote the difference is given as a discount. */
  currentPrice: string;
  /** What the shelf can still give this line (available plus what it already holds). */
  available: number;
  discount: string;
  lineTotal: string;
}

export interface OrderEventView {
  id: string;
  from: OrderStatus | null;
  to: OrderStatus;
  note: string | null;
  by: string;
  at: string;
}

export interface OrderSummary {
  id: string;
  number: string;
  source: SaleSource;
  status: OrderStatus;
  delivery: DeliveryMethod;
  customer: { id: string; name: string; phone: string | null; city: string | null };
  courier: { id: string; name: string } | null;
  total: string;
  deposit: string;
  /** Cash on delivery the courier owes (set when it went out). */
  cod: string;
  settled: string;
  /** Lines not fully reserved. */
  short: number;
  itemCount: number;
  images: string[];
  createdAt: string;
  saleId: string | null;
  version: number;
}

export interface OrderView extends OrderSummary {
  address: string | null;
  city: string | null;
  note: string | null;
  lines: OrderLineView[];
  events: OrderEventView[];
  deposits: PaymentView[];
  sale: { id: string; number: string } | null;
  cancelReason: string | null;
}

// ------------------------------------------------------------------ couriers

export const courierSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: optionalText(30),
  note: optionalText(500),
  isActive: z.boolean().default(true),
});
export const updateCourierSchema = courierSchema.partial();

export interface CourierView {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  isActive: boolean;
  /** What the company owes the shop (the ledger balance). */
  balance: string;
  /** Orders out and not fully settled. */
  openOrders: number;
}

/**
 * The company pays what it collected minus its fee. Orders it covers are listed (or the oldest
 * unsettled first); anything short stays open on the company's account.
 */
export const courierSettlementSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  method: z.enum(['CASH', 'BANK_TRANSFER']),
  /** Received, in the default currency. */
  received: nonNegativeMoneySchema,
  /** The company's delivery fee, an expense. */
  fee: nonNegativeMoneySchema.default('0.00'),
  shiftId: uuidSchema.optional(),
  reference: optionalText(100),
  note: optionalText(500),
  orders: z
    .array(z.object({ orderId: uuidSchema, amount: positiveMoneySchema }))
    .max(500)
    .optional(),
});
export type CourierSettlementInput = z.input<typeof courierSettlementSchema>;

export interface CourierSettlementView {
  id: string;
  number: string;
  courier: { id: string; name: string };
  method: 'CASH' | 'BANK_TRANSFER';
  received: string;
  fee: string;
  reference: string | null;
  note: string | null;
  orders: { orderId: string; number: string; amount: string }[];
  createdAt: string;
  createdBy: string;
}
