import { z } from "zod";
import { booleanInput, decimalInput, paginationSchema } from "@/schemas/common";
import { phoneSchema } from "@/schemas/phone";
import { phoneDigits } from "@/lib/phone";
import { ERROR_CODES } from "@/constants/errors";
import { QUICK_SELL_DETAIL_MAX_LENGTH, QUICK_SELL_NAME_MAX_LENGTH } from "@/constants/quickSell";
import {
  CUSTOMER_SUGGESTION_MIN_DIGITS,
  DISCOUNT_TYPES,
  LATITUDE_MAX,
  LATITUDE_MIN,
  LONGITUDE_MAX,
  LONGITUDE_MIN,
  GIFT_ORDER_CHANNEL,
  GIFT_ORDER_TYPE,
  MAX_BULK_COLLECT_ORDERS,
  ONLINE_ORDER_CHANNELS,
  ORDER_CHANNELS,
  ORDER_SORT_FIELDS,
  ORDER_STATUSES,
  ORDER_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
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

// Optional map pin for a delivery (spec.md "Customer information"). Half a
// coordinate points nowhere, so latitude and longitude arrive together or
// not at all.
const locationShape = {
  customerLatitude: z.coerce
    .number()
    .min(LATITUDE_MIN, ERROR_CODES.ORDER_LOCATION_INVALID)
    .max(LATITUDE_MAX, ERROR_CODES.ORDER_LOCATION_INVALID)
    .nullish(),
  customerLongitude: z.coerce
    .number()
    .min(LONGITUDE_MIN, ERROR_CODES.ORDER_LOCATION_INVALID)
    .max(LONGITUDE_MAX, ERROR_CODES.ORDER_LOCATION_INVALID)
    .nullish(),
};

interface LocationFields {
  customerLatitude?: number | null;
  customerLongitude?: number | null;
}

export function isLocationConsistent(value: LocationFields): boolean {
  const hasLat = value.customerLatitude !== undefined && value.customerLatitude !== null;
  const hasLng = value.customerLongitude !== undefined && value.customerLongitude !== null;
  return hasLat === hasLng;
}

const LOCATION_REFINEMENT = { message: ERROR_CODES.ORDER_LOCATION_INVALID } as const;

// Note what is deliberately absent from every input schema below: unitPrice,
// lineTotal, subtotal and total. Money is derived server-side from the
// catalogue and these discounts, never accepted from the caller.
/**
 * A piece being sold that is not in the catalogue at all (spec.md "Quick
 * sell") — stock that reached the shop floor before it reached the system.
 *
 * This is the ONE place a price is accepted from the caller, and it is worth
 * being blunt about why the rule above does not apply here: there is no
 * catalogue entry to read a price from. Nothing is being overridden — the
 * figure typed at the counter IS the piece's first price, and it becomes the
 * new product's basePrice as well as the line's unitPrice, so the two cannot
 * disagree. Cost is deliberately absent: nobody at the till knows it, and the
 * reports' missing-cost warning is what carries that forward (CLAUDE.md rule
 * 19 keeps cost Admin-only anyway).
 */
export const quickSellItemSchema = z.object({
  name: z.string().trim().min(1, ERROR_CODES.VALIDATION_REQUIRED).max(QUICK_SELL_NAME_MAX_LENGTH),
  price: decimalInput,
  /** A colour, a size, a number — whatever distinguishes this one piece. */
  detail: z.string().trim().max(QUICK_SELL_DETAIL_MAX_LENGTH).optional(),
});
export type QuickSellItemInput = z.infer<typeof quickSellItemSchema>;

/**
 * One line names EITHER something in the catalogue or a quick sale, never
 * both and never neither. Checked here rather than left to the backend so the
 * POS can say which line is wrong before the customer is waiting on a
 * refused checkout.
 */
export function isOrderItemSourceValid(value: {
  productId?: string;
  quickSell?: unknown;
}): boolean {
  return Boolean(value.productId) !== Boolean(value.quickSell);
}

const ITEM_SOURCE_REFINEMENT = { message: ERROR_CODES.ORDER_ITEM_SOURCE_INVALID } as const;

export const createOrderItemSchema = z
  .object({
    // Optional ONLY because of quick sell below: an ordinary line still names
    // a product, and the refinement refuses a line that names neither.
    productId: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED).optional(),
    // Required when the product has variants — the variant is the thing
    // actually sold, and it owns the price and the stock.
    variantId: z.string().min(1).optional(),
    quickSell: quickSellItemSchema.optional(),
    quantity: z.coerce.number().int().min(1, ERROR_CODES.VALIDATION_INVALID_NUMBER),
    ...discountShape,
  })
  .refine(isDiscountConsistent, DISCOUNT_REFINEMENT)
  .refine(isOrderItemSourceValid, ITEM_SOURCE_REFINEMENT);
export type CreateOrderItemInput = z.infer<typeof createOrderItemSchema>;

export const createOrderSchema = z
  .object({
    channel: z.enum(ORDER_CHANNELS),
    // SALE unless the shop says otherwise. A GIFT needs order.createGift
    // (Admin/Manager), which is checked on the backend — the type here only
    // says what is being asked for.
    type: z.enum(ORDER_TYPES).default("SALE"),
    paymentMethod: z.enum(PAYMENT_METHODS).default("CASH"),
    items: z.array(createOrderItemSchema).min(1, ERROR_CODES.ORDER_ITEMS_REQUIRED),
    customerName: z.string().min(1).optional(),
    customerPhone: phoneSchema.optional(),
    customerWhatsapp: phoneSchema.optional(),
    customerAddress: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
    ...locationShape,
    ...discountShape,
  })
  .refine(isDiscountConsistent, DISCOUNT_REFINEMENT)
  .refine(isLocationConsistent, LOCATION_REFINEMENT)
  // An order taken over WhatsApp or the website has to be deliverable back to
  // someone; a STORE sale is handed over at the counter and needs nobody.
  .refine(
    (v) =>
      !(ONLINE_ORDER_CHANNELS as readonly string[]).includes(v.channel) ||
      Boolean(v.customerName && v.customerPhone),
    { message: ERROR_CODES.ORDER_CUSTOMER_REQUIRED }
  )
  // A gift is handed over at the counter, in person. A parcel the shop pays
  // the delivery company to carry and is never paid for is a different
  // problem, and pretending it is a gift would hide it.
  .refine((v) => v.type !== GIFT_ORDER_TYPE || v.channel === GIFT_ORDER_CHANNEL, {
    message: ERROR_CODES.ORDER_GIFT_CHANNEL_INVALID,
  });
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
    ...locationShape,
    ...discountShape,
  })
  .refine(isDiscountConsistent, DISCOUNT_REFINEMENT)
  .refine(isLocationConsistent, LOCATION_REFINEMENT);
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

// Settling up with the delivery company: the ids of the orders it has just
// paid for. One id or a whole run of them — the shop is normally handed a
// batch — but always a bounded list.
export const collectOrdersSchema = z.object({
  orderIds: z
    .array(z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED))
    .min(1, ERROR_CODES.VALIDATION_REQUIRED)
    .max(MAX_BULK_COLLECT_ORDERS, ERROR_CODES.VALIDATION_INVALID_NUMBER),
});
export type CollectOrdersInput = z.infer<typeof collectOrdersSchema>;

// Looking a repeat customer up by the digits the cashier has typed so far.
// Not a paginated list: it is an autocomplete, capped at
// CUSTOMER_SUGGESTION_LIMIT entries server-side, and a cashier who needs to
// page through matches is better off typing another digit.
export const customerSuggestionsQuerySchema = z.object({
  q: z
    .string()
    .refine((v) => phoneDigits(v).length >= CUSTOMER_SUGGESTION_MIN_DIGITS, ERROR_CODES.VALIDATION_INVALID_PHONE),
});
export type CustomerSuggestionsQuery = z.infer<typeof customerSuggestionsQuerySchema>;

export const listOrdersQuerySchema = paginationSchema.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  channel: z.enum(ORDER_CHANNELS).optional(),
  // Sales or gifts. Unset means both — the orders list is the record of
  // everything that left the shop, however it left.
  type: z.enum(ORDER_TYPES).optional(),
  // Drives the "still owed by the delivery company" view: the outstanding
  // list is this filter set to PENDING_COLLECTION.
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  // Narrows a payment-status filter to the sales that can still be settled —
  // a cancelled or fully returned order owes nothing, so it must not sit in
  // the outstanding list looking like money on its way.
  collectableOnly: booleanInput.optional(),
  // "Show me the sales that were rung up before the piece existed" (spec.md
  // "Quick sell") — the after-the-season review list. True narrows to them;
  // unset lists everything, since a quick sale is an ordinary sale in every
  // other respect.
  hasQuickSale: booleanInput.optional(),
  // Inclusive date range over createdAt.
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  // Order number, customer name or customer phone.
  q: z.string().min(1).optional(),
  sortBy: z.enum(ORDER_SORT_FIELDS).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
