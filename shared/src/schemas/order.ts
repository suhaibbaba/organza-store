import { z } from "zod";
import { decimalInput, paginationSchema } from "@/schemas/common";
import { phoneSchema } from "@/schemas/phone";
import { ERROR_CODES } from "@/constants/errors";
import {
  DISCOUNT_TYPES,
  ONLINE_ORDER_CHANNELS,
  ORDER_CHANNELS,
  ORDER_SORT_FIELDS,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PERCENT_MAX,
  PERCENT_MIN,
} from "@/constants/order";

// A discount is always a (type, value) pair: either both are given or
// neither is. A PERCENT value is additionally bounded to 0-100 — the amount
// itself is computed on the server, so this is the only thing worth checking
// up front.
interface DiscountFields {
  discountType?: string | null;
  discountValue?: string | null;
}

export function isDiscountConsistent(value: DiscountFields): boolean {
  const hasType = value.discountType !== undefined && value.discountType !== null;
  const hasValue = value.discountValue !== undefined && value.discountValue !== null;
  if (hasType !== hasValue) return false;
  if (!hasType) return true;
  const amount = Number(value.discountValue);
  if (value.discountType === "PERCENT") return amount >= PERCENT_MIN && amount <= PERCENT_MAX;
  return amount >= 0;
}

const discountShape = {
  discountType: z.enum(DISCOUNT_TYPES).nullish(),
  discountValue: decimalInput.nullish(),
};

const DISCOUNT_REFINEMENT = { message: ERROR_CODES.ORDER_DISCOUNT_INVALID } as const;

// Note what is deliberately absent from every input schema below: unitPrice,
// lineTotal, subtotal and total. Money is derived server-side from the
// catalogue and these discounts, never accepted from the caller.
export const createOrderItemSchema = z
  .object({
    productId: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
    // Required when the product has variants — the variant is the thing
    // actually sold, and it owns the price and the stock.
    variantId: z.string().min(1).optional(),
    quantity: z.coerce.number().int().min(1, ERROR_CODES.VALIDATION_INVALID_NUMBER),
    ...discountShape,
  })
  .refine(isDiscountConsistent, DISCOUNT_REFINEMENT);
export type CreateOrderItemInput = z.infer<typeof createOrderItemSchema>;

export const createOrderSchema = z
  .object({
    channel: z.enum(ORDER_CHANNELS),
    paymentMethod: z.enum(PAYMENT_METHODS).default("CASH"),
    items: z.array(createOrderItemSchema).min(1, ERROR_CODES.ORDER_ITEMS_REQUIRED),
    customerName: z.string().min(1).optional(),
    customerPhone: phoneSchema.optional(),
    customerWhatsapp: phoneSchema.optional(),
    customerAddress: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
    ...discountShape,
  })
  .refine(isDiscountConsistent, DISCOUNT_REFINEMENT)
  // An order taken over WhatsApp or the website has to be deliverable back to
  // someone; a STORE sale is handed over at the counter and needs nobody.
  .refine(
    (v) =>
      !(ONLINE_ORDER_CHANNELS as readonly string[]).includes(v.channel) ||
      Boolean(v.customerName && v.customerPhone),
    { message: ERROR_CODES.ORDER_CUSTOMER_REQUIRED }
  );
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// Editing reprices an existing order: contact details, the note, the payment
// method and the discounts (order- and item-level). Adding or removing lines
// is deliberately not supported — cancel the order and take a new one, so the
// stock already committed against it stays traceable.
//
// An entry here replaces that line's discount outright: `{ id }` on its own
// clears it. Lines left out of `items` keep whatever they had.
export const updateOrderItemSchema = z
  .object({
    id: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
    ...discountShape,
  })
  .refine(isDiscountConsistent, DISCOUNT_REFINEMENT);
export type UpdateOrderItemInput = z.infer<typeof updateOrderItemSchema>;

export const updateOrderSchema = z
  .object({
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    customerName: z.string().min(1).nullish(),
    customerPhone: phoneSchema.nullish(),
    customerWhatsapp: phoneSchema.nullish(),
    customerAddress: z.string().min(1).nullish(),
    note: z.string().min(1).nullish(),
    items: z.array(updateOrderItemSchema).min(1).optional(),
    ...discountShape,
  })
  .refine(isDiscountConsistent, DISCOUNT_REFINEMENT);
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

// Omit `items` to return the whole order (every line, in whatever quantity is
// still outstanding); pass them to return specific lines partially.
export const returnOrderItemSchema = z.object({
  orderItemId: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  quantity: z.coerce.number().int().min(1, ERROR_CODES.VALIDATION_INVALID_NUMBER),
});
export type ReturnOrderItemInput = z.infer<typeof returnOrderItemSchema>;

export const returnOrderSchema = z.object({
  items: z.array(returnOrderItemSchema).min(1).optional(),
});
export type ReturnOrderInput = z.infer<typeof returnOrderSchema>;

export const listOrdersQuerySchema = paginationSchema.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  channel: z.enum(ORDER_CHANNELS).optional(),
  // Inclusive date range over createdAt.
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  // Order number, customer name or customer phone.
  q: z.string().min(1).optional(),
  sortBy: z.enum(ORDER_SORT_FIELDS).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
