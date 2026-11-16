import { z } from 'zod';
import {
  idempotencyKeySchema,
  nonNegativeMoneySchema,
  paginationSchema,
  positiveMoneySchema,
  type Translatable,
  uuidSchema,
} from './common.js';
import { currencyCodeSchema } from './settings.js';

// ------------------------------------------------------------------ constants

export const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'STORE_CREDIT'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SALE_SOURCES = ['COUNTER', 'WHATSAPP', 'ONLINE', 'PHONE'] as const;
export type SaleSource = (typeof SALE_SOURCES)[number];

export const FULFILMENT_MODES = ['TAKEN', 'HELD'] as const;
export type FulfilmentMode = (typeof FULFILMENT_MODES)[number];

export type SaleStatus = 'COMPLETED' | 'CANCELLED' | 'VOIDED';
export type FulfilmentStatus = 'FULFILLED' | 'HELD' | 'PARTLY_HANDED';
export type PaymentState = 'PAID' | 'PARTLY_PAID' | 'UNPAID';

export const SHIFT_STATUSES = ['OPEN', 'LEFT_OPEN', 'COUNTED', 'CLOSED'] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

export const CASH_MOVEMENT_TYPES = ['PAID_IN', 'DROP', 'EXPENSE'] as const;
export type CashMovementType = (typeof CASH_MOVEMENT_TYPES)[number];

export const CASH_PLACES = ['SAFE', 'BANK'] as const;
export type CashPlace = (typeof CASH_PLACES)[number];

/** Expense categories paid from the drawer (the journal dimension of OPERATING_EXPENSES). */
export const EXPENSE_CATEGORIES = [
  'SUPPLIES',
  'DELIVERY',
  'FOOD',
  'CLEANING',
  'MAINTENANCE',
  'UTILITIES',
  'RENT',
  'SALARIES',
  'OTHER',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** What happens to the money when a held sale that was never handed over is cancelled. */
export const HELD_CANCEL_OUTCOMES = ['REFUND', 'CREDIT', 'KEEP_DEPOSIT'] as const;
export type HeldCancelOutcome = (typeof HELD_CANCEL_OUTCOMES)[number];

// ------------------------------------------------------------------ customers

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const customerInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  /** As typed; the server turns it into E.164 with the shop's default prefix. */
  phone: optionalText(40),
  whatsapp: optionalText(40),
  address: optionalText(300),
  city: optionalText(80),
  notes: optionalText(1000),
});
export type CustomerInput = z.input<typeof customerInputSchema>;

export const customerListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  withDebt: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const mergeCustomersSchema = z.object({
  /** The duplicate whose history moves into the customer in the URL. */
  fromId: uuidSchema,
  reason: z.string().trim().min(3).max(500),
});

export interface CustomerView {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  /** What the customer owes the shop (receivables). */
  debt: string;
  /** Store credit the customer can spend. */
  credit: string;
  /** Deposits paid on goods still held for the customer. */
  deposits: string;
  createdAt: string;
}

export interface StatementRow {
  date: string;
  at: string;
  kind: 'SALE' | 'PAYMENT' | 'REFUND' | 'HANDOVER' | 'CANCEL' | 'CORRECTION' | 'OTHER';
  number: string | null;
  sourceId: string;
  /** Positive raises what the customer owes, negative lowers it. */
  amount: string;
  /** Debt minus credit after this row. */
  balance: string;
  event: string;
}

// ------------------------------------------------------------------ registers and shifts

export const registerInputSchema = z.object({ name: z.string().trim().min(1).max(60) });

const currencyAmountSchema = z.object({
  currency: currencyCodeSchema,
  amount: nonNegativeMoneySchema,
  /** Optional breakdown: denomination ("200", "0.50") → how many. */
  denominations: z.record(z.string(), z.number().int().min(0).max(100_000)).optional(),
});

export const openShiftSchema = z.object({
  registerId: uuidSchema,
  float: z.array(currencyAmountSchema).max(10).default([]),
  note: z.string().trim().max(500).optional(),
});

export const countShiftSchema = z.object({
  counts: z.array(currencyAmountSchema).min(1).max(10),
  note: z.string().trim().max(500).optional(),
});

export const closeShiftSchema = z.object({
  /** Cash taken out of the drawer at close, by currency. What stays is the next float. */
  drops: z
    .array(
      z.object({
        currency: currencyCodeSchema,
        amount: positiveMoneySchema,
        to: z.enum(CASH_PLACES),
      }),
    )
    .max(20)
    .default([]),
  /** Required when the count differs from the expected figure. */
  note: z.string().trim().max(1000).optional(),
});

export const signOffShiftSchema = z.object({ note: z.string().trim().min(1).max(1000) });

export const cashMovementInputSchema = z
  .object({
    idempotencyKey: idempotencyKeySchema,
    type: z.enum(CASH_MOVEMENT_TYPES),
    currency: currencyCodeSchema,
    amount: positiveMoneySchema,
    /** SAFE or BANK for paid-in and drops; an expense category for expenses. */
    counterpart: z.string().trim().min(1).max(40),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    const ok =
      v.type === 'EXPENSE'
        ? (EXPENSE_CATEGORIES as readonly string[]).includes(v.counterpart)
        : (CASH_PLACES as readonly string[]).includes(v.counterpart);
    if (!ok)
      ctx.addIssue({ code: 'custom', path: ['counterpart'], message: 'INVALID_COUNTERPART' });
    if (v.type === 'EXPENSE' && !v.note)
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'NOTE_REQUIRED' });
  });

export interface ExpectedLine {
  kind:
    | 'OPENING_FLOAT'
    | 'CASH_SALES'
    | 'CASH_REPAYMENTS'
    | 'CHANGE_GIVEN'
    | 'CASH_REFUNDS'
    | 'PAID_IN'
    | 'DROPS'
    | 'EXPENSES';
  amount: string;
  count: number;
}

export interface CurrencyReconciliation {
  currency: string;
  expected: string;
  counted: string | null;
  difference: string | null;
  lines: ExpectedLine[];
}

export interface ShiftView {
  id: string;
  number: string;
  register: { id: string; name: string };
  status: ShiftStatus;
  businessDate: string;
  openedBy: { id: string; name: string };
  openedAt: string;
  countedAt: string | null;
  closedAt: string | null;
  closedBy: { id: string; name: string } | null;
  closeNote: string | null;
  hasDifference: boolean;
  signedOffAt: string | null;
  signOffNote: string | null;
  /** Opening float per currency (always visible). */
  float: { currency: string; amount: string }[];
  /** Null until the blind count is submitted: the expected figure is never shown before. */
  reconciliation: CurrencyReconciliation[] | null;
  /** Sale count and non-cash takings during the shift; cash and the total only after the count. */
  totals: {
    sales: number;
    salesTotal: string | null;
    byMethod: { method: PaymentMethod; amount: string }[];
  };
  movements: CashMovementView[];
  /** History from the old system: read-only, figures as the old system froze them. */
  imported: boolean;
}

export interface CashMovementView {
  id: string;
  number: string;
  type: CashMovementType;
  currency: string;
  amount: string;
  amountDefault: string;
  counterpart: string;
  note: string | null;
  createdAt: string;
  createdBy: string;
  reversed: boolean;
}

export interface RegisterView {
  id: string;
  name: string;
  isActive: boolean;
  openShift: { id: string; number: string; openedBy: string; openedAt: string } | null;
  /** Shifts still needing a count (left open on an earlier day). */
  pendingCounts: number;
  /** A shift counted but not yet closed (selling stops at the count; the close comes next). */
  countedShiftId: string | null;
}

// ------------------------------------------------------------------ sales

export const paymentInputSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  currency: currencyCodeSchema,
  /** In `currency`: the amount handed over (cash may exceed what is due; change is given). */
  amount: positiveMoneySchema,
  /** The rate the cashier saw; refused if it changed since (default currency is always 1). */
  rate: z.string().optional(),
  reference: z.string().trim().max(80).optional(),
});
export type PaymentInput = z.input<typeof paymentInputSchema>;

export const checkoutLineSchema = z.object({
  itemId: uuidSchema,
  quantity: z.number().int().min(1).max(10_000),
  /** The unit price the cashier saw; refused with PRICE_CHANGED if the server price differs. */
  unitPrice: nonNegativeMoneySchema,
  /** Discount on the whole line, in the default currency. */
  discount: nonNegativeMoneySchema.default('0.00'),
  /** A giveaway (Admin/Manager): free to the customer, its cost booked as a promotion. */
  giveaway: z.boolean().default(false),
});

export const checkoutSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  shiftId: uuidSchema.optional(),
  customerId: uuidSchema.optional().nullable(),
  source: z.enum(SALE_SOURCES).default('COUNTER'),
  mode: z.enum(FULFILMENT_MODES).default('TAKEN'),
  lines: z.array(checkoutLineSchema).min(1).max(200),
  /** A discount on the whole cart, spread over the lines by value. */
  cartDiscount: nonNegativeMoneySchema.default('0.00'),
  payments: z.array(paymentInputSchema).max(10).default([]),
  /** Over-tender: give change in cash (default) or keep it as store credit. */
  overpayment: z.enum(['CHANGE', 'CREDIT']).default('CHANGE'),
  /** The same cart was sold by this cashier within a minute; true saves it anyway. */
  confirmDuplicate: z.boolean().default(false),
  /** A gift purchase: a gift receipt without prices can be printed. */
  giftReceipt: z.boolean().default(false),
  note: z.string().trim().max(500).optional(),
});
export type CheckoutInput = z.input<typeof checkoutSchema>;

export const receivePaymentSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  shiftId: uuidSchema.optional(),
  payments: z.array(paymentInputSchema).min(1).max(10),
  /** Picked by the cashier; omitted: oldest unpaid sales first. The rest becomes credit. */
  allocations: z
    .array(z.object({ saleId: uuidSchema, amount: positiveMoneySchema }))
    .max(100)
    .optional(),
  note: z.string().trim().max(500).optional(),
});

export const handoverSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  /** Omitted: everything still held. */
  lines: z.array(z.object({ lineId: uuidSchema, quantity: z.number().int().min(1) })).optional(),
  /** Must be true when money is still owed; the screen asks first (decision: case by case). */
  acknowledgeOwed: z.boolean().default(false),
});

export const cancelHeldSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  outcome: z.enum(HELD_CANCEL_OUTCOMES),
  /** For a refund: where the money is paid from. Cash needs an open shift. */
  refundMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER']).optional(),
  shiftId: uuidSchema.optional(),
  reason: z.string().trim().min(3).max(500),
});

export const RETURN_CONDITIONS = ['SHELF', 'DAMAGED'] as const;
export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];
export const RETURN_SETTLEMENTS = ['REFUND', 'CREDIT'] as const;
export type ReturnSettlement = (typeof RETURN_SETTLEMENTS)[number];
export type ReturnKind = 'RETURN' | 'EXCHANGE' | 'VOID';
export const REFUND_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER'] as const;

const settlementFields = {
  idempotencyKey: idempotencyKeySchema,
  /** The till's open shift: cash refunds come out of it, exchanges are sold on it. */
  shiftId: uuidSchema.optional(),
  /**
   * What happens to money already paid for the goods once any debt on the sale is cleared:
   * paid back (method defaults to how the sale was paid) or kept as store credit.
   */
  settlement: z.enum(RETURN_SETTLEMENTS).default('REFUND'),
  refundMethod: z.enum(REFUND_METHODS).optional(),
  reason: z.string().trim().min(3).max(500),
};

export const returnLineSchema = z.object({
  lineId: uuidSchema,
  quantity: z.number().int().min(1).max(10_000),
  condition: z.enum(RETURN_CONDITIONS).default('SHELF'),
});

export const createReturnSchema = z.object({
  ...settlementFields,
  saleId: uuidSchema,
  lines: z.array(returnLineSchema).min(1).max(200),
  /** New goods for an exchange; the returned value pays for them first. */
  exchange: z
    .object({
      lines: z.array(checkoutLineSchema).min(1).max(200),
      cartDiscount: nonNegativeMoneySchema.default('0.00'),
      payments: z.array(paymentInputSchema).max(10).default([]),
    })
    .optional(),
});
export type CreateReturnInput = z.input<typeof createReturnSchema>;

/** A manager reverses a completed sale: everything not yet returned comes back to the shelf. */
export const voidSaleSchema = z.object(settlementFields);
export type VoidSaleInput = z.input<typeof voidSaleSchema>;

export interface ReturnLineView {
  id: string;
  saleLineId: string;
  name: Translatable;
  variantLabel: Translatable | null;
  quantity: number;
  condition: ReturnCondition;
  value: string;
}

export interface ReturnView {
  id: string;
  number: string;
  kind: ReturnKind;
  sale: { id: string; number: string };
  customer: { id: string; name: string } | null;
  createdAt: string;
  createdBy: string;
  approvedBy: string | null;
  value: string;
  debtReduced: string;
  toExchange: string;
  refunded: string;
  refundMethod: PaymentMethod | null;
  toCredit: string;
  exchangeSale: { id: string; number: string; total: string } | null;
  reason: string;
  lines: ReturnLineView[];
}

export const saleListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  customerId: uuidSchema.optional(),
  shiftId: uuidSchema.optional(),
  state: z.enum(['PAID', 'PARTLY_PAID', 'UNPAID', 'OWED']).optional(),
  held: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export interface SaleLineView {
  id: string;
  itemId: string | null;
  productId: string | null;
  name: Translatable;
  variantLabel: Translatable | null;
  sku: string | null;
  quantity: number;
  unitPrice: string;
  discount: string;
  lineTotal: string;
  handedOver: number;
  /** Pieces already brought back. */
  returned: number;
  giveaway: boolean;
  imageUrl: string | null;
}

export interface PaymentView {
  id: string;
  number: string;
  direction: 'IN' | 'OUT';
  method: PaymentMethod;
  currency: string;
  amount: string;
  rate: string;
  amountDefault: string;
  reference: string | null;
  purpose: string;
  /** The part of this payment counted against this sale (sale view only). */
  allocated?: string;
  takenAt: string;
  takenBy: string;
  reversed: boolean;
}

export interface SaleView {
  id: string;
  number: string;
  source: SaleSource;
  status: SaleStatus;
  mode: FulfilmentMode;
  fulfilment: FulfilmentStatus;
  businessDate: string;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  customer: { id: string; name: string; phone: string | null } | null;
  shift: { id: string; number: string } | null;
  lines: SaleLineView[];
  subtotal: string;
  discountTotal: string;
  total: string;
  /** The value of the goods returned so far; what is due is total minus this. */
  returnedTotal: string;
  paid: string;
  /** Total minus returned minus paid. */
  owed: string;
  paymentState: PaymentState;
  payments: PaymentView[];
  /** Change given back in cash at checkout (default currency). */
  change: string;
  /** Over-tender kept as store credit at checkout. */
  creditKept: string;
  note: string | null;
  imported: boolean;
  cancelReason: string | null;
  cancelOutcome: string | null;
  heldDays: number | null;
  giftReceipt: boolean;
  returns: { id: string; number: string; kind: ReturnKind; value: string; createdAt: string }[];
  /** The sale an exchange came from, when this sale is the new half of one. */
  exchangeOf: { returnId: string; saleId: string; saleNumber: string } | null;
  /** True when this response replays a checkout already saved under the same key. */
  replayed?: boolean;
}

export interface SaleSummary {
  id: string;
  number: string;
  createdAt: string;
  customer: { id: string; name: string } | null;
  status: SaleStatus;
  mode: FulfilmentMode;
  fulfilment: FulfilmentStatus;
  total: string;
  returnedTotal: string;
  paid: string;
  owed: string;
  paymentState: PaymentState;
  itemCount: number;
  imported: boolean;
  heldDays: number | null;
}

/** Everything a printed or shared receipt needs, already localised by the client. */
export interface ReceiptData {
  sale: SaleView;
  shop: { name: Translatable; phone: string; address: Translatable; footer: Translatable };
  currency: string;
  /** Customer's balance after this sale: debt minus store credit (deposits on held goods excluded). */
  customerBalance: string | null;
}

export interface PaymentReceipt {
  payments: PaymentView[];
  allocations: { saleId: string; saleNumber: string; amount: string }[];
  /** Kept as store credit (what was not allocated). */
  toCredit: string;
  customer: CustomerView;
}
