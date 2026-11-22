import { z } from "zod";
import { booleanInput, decimalInput, paginationSchema } from "@/schemas/common";
import { phoneSchema } from "@/schemas/phone";
import { ERROR_CODES } from "@/constants/errors";
import {
  SUPPLIER_ADDRESS_MAX_LENGTH,
  SUPPLIER_INVOICE_NOTE_MAX_LENGTH,
  SUPPLIER_INVOICE_NUMBER_MAX_LENGTH,
  SUPPLIER_NAME_MAX_LENGTH,
  SUPPLIER_NOTE_MAX_LENGTH,
  SUPPLIER_PAYMENT_NOTE_MAX_LENGTH,
  SUPPLIER_SORT_FIELDS,
} from "@/constants/supplier";

const nameSchema = z.string().trim().min(1, ERROR_CODES.VALIDATION_REQUIRED).max(SUPPLIER_NAME_MAX_LENGTH);
const optionalText = (max: number) => z.string().trim().min(1).max(max).nullish();

export const createSupplierSchema = z.object({
  name: nameSchema,
  phone: phoneSchema.nullish(),
  whatsapp: phoneSchema.nullish(),
  address: optionalText(SUPPLIER_ADDRESS_MAX_LENGTH),
  note: optionalText(SUPPLIER_NOTE_MAX_LENGTH),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial();
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const listSuppliersQuerySchema = paginationSchema.extend({
  // Name or phone digits.
  q: z.string().trim().min(1).optional(),
  // Only suppliers the shop still owes.
  owing: booleanInput.optional(),
  sortBy: z.enum(SUPPLIER_SORT_FIELDS).default("lastInvoiceAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;

const positiveMoney = decimalInput.refine((v) => Number(v) > 0, { message: ERROR_CODES.VALIDATION_INVALID_NUMBER });
// A plain calendar date (YYYY-MM-DD), the day printed on the invoice.
const invoiceDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, ERROR_CODES.VALIDATION_REQUIRED);

export const createSupplierInvoiceSchema = z.object({
  invoiceNumber: optionalText(SUPPLIER_INVOICE_NUMBER_MAX_LENGTH),
  invoiceDate: invoiceDateSchema,
  total: positiveMoney,
  // Paid on the spot (zero allowed, never more than the total); whether it left the till is asked like any payment.
  paidNow: decimalInput.optional(),
  paidFromDrawer: booleanInput.optional(),
  note: optionalText(SUPPLIER_INVOICE_NOTE_MAX_LENGTH),
});
export type CreateSupplierInvoiceInput = z.infer<typeof createSupplierInvoiceSchema>;

export const updateSupplierInvoiceSchema = z.object({
  invoiceNumber: optionalText(SUPPLIER_INVOICE_NUMBER_MAX_LENGTH),
  invoiceDate: invoiceDateSchema.optional(),
  total: positiveMoney.optional(),
  note: optionalText(SUPPLIER_INVOICE_NOTE_MAX_LENGTH),
});
export type UpdateSupplierInvoiceInput = z.infer<typeof updateSupplierInvoiceSchema>;

// Against one invoice when `invoiceId` is given, otherwise spread oldest invoice first; `preview` saves nothing.
export const supplierPaymentSchema = z.object({
  amount: positiveMoney,
  fromDrawer: booleanInput.default(false),
  invoiceId: z.string().min(1).optional(),
  note: z.string().trim().min(1).max(SUPPLIER_PAYMENT_NOTE_MAX_LENGTH).optional(),
  preview: booleanInput.optional(),
});
export type SupplierPaymentInput = z.input<typeof supplierPaymentSchema>;
export type SupplierPaymentBody = z.infer<typeof supplierPaymentSchema>;
