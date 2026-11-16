import { z } from 'zod';
import type { Translatable } from './common.js';
import { currencyCodeSchema } from './settings.js';
import {
  idempotencyKeySchema,
  nonNegativeMoneySchema,
  paginationSchema,
  positiveMoneySchema,
  uuidSchema,
} from './common.js';

/**
 * Suppliers and purchasing (proposal C8). A purchase order is optional: what was asked for. A
 * receipt is what arrived and what is owed for it (the supplier's invoice): it adds stock at
 * cost and raises the supplier's balance. A credit note lowers it (goods sent back, or a price
 * allowance). Payments are allocated to receipts oldest first.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

/** Unit costs keep four decimals (a dozen at 100.00 is 8.3333 each). */
export const unitCostSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d{1,8}(\.\d{1,4})?$/.test(v), 'INVALID_COST');

export const supplierSchema = z.object({
  name: z.string().trim().min(1).max(120),
  contactName: optionalText(120),
  phone: optionalText(30),
  address: optionalText(300),
  note: optionalText(1000),
  isActive: z.boolean().default(true),
});
export const updateSupplierSchema = supplierSchema.partial();
export type SupplierInput = z.input<typeof supplierSchema>;

export interface SupplierView {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  note: string | null;
  isActive: boolean;
  /** What the shop owes the supplier (positive) or has paid ahead (negative). */
  owed: string;
  openReceipts: number;
  openOrders: number;
}

export const supplierListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  owed: z.stringbool().optional(),
  active: z.stringbool().optional(),
});

// ------------------------------------------------------------------ purchase orders

export const PURCHASE_ORDER_STATUSES = ['OPEN', 'CLOSED', 'CANCELLED'] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const purchaseLineSchema = z.object({
  itemId: uuidSchema,
  quantity: z.number().int().min(1).max(10_000),
  unitCost: unitCostSchema,
});

export const createPurchaseOrderSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  supplierId: uuidSchema,
  expectedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  note: optionalText(1000),
  lines: z.array(purchaseLineSchema).min(1).max(500),
});
export type CreatePurchaseOrderInput = z.input<typeof createPurchaseOrderSchema>;

/** Close an order that will not be delivered in full ("closed short"), or cancel it. */
export const closePurchaseOrderSchema = z.object({
  outcome: z.enum(['CLOSED', 'CANCELLED']),
  reason: z.string().trim().min(3).max(500),
});

export interface PurchaseLineView {
  id: string;
  itemId: string;
  productId: string;
  name: Translatable;
  variantLabel: Translatable | null;
  sku: string;
  quantity: number;
  unitCost: string;
}

export interface PurchaseOrderView {
  id: string;
  number: string;
  supplier: { id: string; name: string };
  status: PurchaseOrderStatus;
  expectedAt: string | null;
  note: string | null;
  total: string;
  lines: (PurchaseLineView & { received: number; open: number })[];
  receipts: { id: string; number: string; createdAt: string }[];
  closeReason: string | null;
  createdAt: string;
  createdBy: string;
}

export interface PurchaseOrderSummary {
  id: string;
  number: string;
  supplier: { id: string; name: string };
  status: PurchaseOrderStatus;
  expectedAt: string | null;
  total: string;
  ordered: number;
  received: number;
  createdAt: string;
}

// ------------------------------------------------------------------ receipts

export const SUPPLIER_PAYMENT_METHODS = ['CASH', 'SAFE', 'BANK_TRANSFER', 'CARD'] as const;
export type SupplierPaymentMethod = (typeof SUPPLIER_PAYMENT_METHODS)[number];

export const supplierPaymentInputSchema = z.object({
  method: z.enum(SUPPLIER_PAYMENT_METHODS),
  currency: currencyCodeSchema,
  amount: positiveMoneySchema,
  rate: z.string().optional(),
  reference: optionalText(100),
});

export const createReceiptSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  supplierId: uuidSchema,
  /** Received against an order; lines of that order count as delivered. */
  purchaseOrderId: uuidSchema.optional(),
  /** The supplier's own invoice number. */
  supplierRef: optionalText(60),
  note: optionalText(1000),
  lines: z.array(purchaseLineSchema).min(1).max(500),
  /** Shipping, customs and the like, spread over the lines by value into their cost. */
  extraCosts: nonNegativeMoneySchema.default('0.00'),
  /** Paid on delivery (cash from the till needs its open shift). */
  payment: supplierPaymentInputSchema.optional(),
  shiftId: uuidSchema.optional(),
});
export type CreateReceiptInput = z.input<typeof createReceiptSchema>;

export interface ReceiptLineView extends PurchaseLineView {
  /** Unit cost with its share of the extra costs: what the stock now carries. */
  landedCost: string;
  lineTotal: string;
  returned: number;
}

export interface ReceiptView {
  id: string;
  number: string;
  supplier: { id: string; name: string };
  purchaseOrder: { id: string; number: string } | null;
  supplierRef: string | null;
  note: string | null;
  subtotal: string;
  extraCosts: string;
  total: string;
  paid: string;
  open: string;
  lines: ReceiptLineView[];
  createdAt: string;
  createdBy: string;
}

export interface ReceiptSummary {
  id: string;
  number: string;
  supplier: { id: string; name: string };
  supplierRef: string | null;
  total: string;
  paid: string;
  open: string;
  itemCount: number;
  createdAt: string;
}

export const receiptListQuerySchema = paginationSchema.extend({
  supplierId: uuidSchema.optional(),
  open: z.stringbool().optional(),
});

// ------------------------------------------------------------------ credit notes

/** RETURN: goods go back to the supplier. ALLOWANCE: a price reduction, no goods move. */
export const CREDIT_NOTE_KINDS = ['RETURN', 'ALLOWANCE'] as const;
export type CreditNoteKind = (typeof CREDIT_NOTE_KINDS)[number];

export const createCreditNoteSchema = z
  .object({
    idempotencyKey: idempotencyKeySchema,
    supplierId: uuidSchema,
    kind: z.enum(CREDIT_NOTE_KINDS),
    /** The receipt it corrects; omitted: it lowers the oldest open receipts. */
    receiptId: uuidSchema.optional(),
    supplierRef: optionalText(60),
    reason: z.string().trim().min(3).max(500),
    /** RETURN: what goes back and the credit per unit (from on-hand, or the damaged shelf). */
    lines: z
      .array(
        z.object({
          itemId: uuidSchema,
          quantity: z.number().int().min(1).max(10_000),
          unitCredit: unitCostSchema,
          fromDamaged: z.boolean().default(false),
        }),
      )
      .max(500)
      .default([]),
    /** ALLOWANCE: the amount credited. */
    amount: nonNegativeMoneySchema.optional(),
  })
  .refine((v) => (v.kind === 'RETURN' ? v.lines.length > 0 : Number(v.amount ?? 0) > 0), {
    message: 'CREDIT_NOTE_EMPTY',
    path: ['lines'],
  });
export type CreateCreditNoteInput = z.input<typeof createCreditNoteSchema>;

export interface CreditNoteView {
  id: string;
  number: string;
  supplier: { id: string; name: string };
  kind: CreditNoteKind;
  receipt: { id: string; number: string } | null;
  supplierRef: string | null;
  reason: string;
  amount: string;
  lines: {
    itemId: string;
    name: Translatable;
    sku: string;
    quantity: number;
    unitCredit: string;
    fromDamaged: boolean;
  }[];
  createdAt: string;
  createdBy: string;
}

// ------------------------------------------------------------------ payments

export const supplierPaySchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  /** OUT: the shop pays. IN: the supplier pays back money it owed (a refund). */
  direction: z.enum(['OUT', 'IN']).default('OUT'),
  payment: supplierPaymentInputSchema,
  shiftId: uuidSchema.optional(),
  note: optionalText(500),
  /** Receipts this payment settles; omitted: oldest open first. */
  allocations: z
    .array(z.object({ receiptId: uuidSchema, amount: positiveMoneySchema }))
    .max(200)
    .optional(),
});
export type SupplierPayInput = z.input<typeof supplierPaySchema>;

export interface SupplierPaymentView {
  id: string;
  number: string;
  direction: 'IN' | 'OUT';
  method: SupplierPaymentMethod;
  currency: string;
  amount: string;
  rate: string;
  amountDefault: string;
  reference: string | null;
  note: string | null;
  allocations: { receiptId: string; number: string; amount: string }[];
  takenAt: string;
  takenBy: string;
}

/** One line of a supplier's statement, oldest first with a running balance. */
export interface SupplierStatementRow {
  date: string;
  kind: 'RECEIPT' | 'CREDIT_NOTE' | 'PAYMENT' | 'REFUND' | 'OPENING';
  number: string;
  documentId: string;
  /** Raises what is owed. */
  debit: string;
  /** Lowers it. */
  credit: string;
  balance: string;
}

/** What an item cost each time it was received, newest first. */
export interface ItemCostRow {
  receiptId: string;
  number: string;
  supplier: { id: string; name: string };
  quantity: number;
  unitCost: string;
  landedCost: string;
  createdAt: string;
}
