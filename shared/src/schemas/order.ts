import { z } from "zod";
import { booleanInput, decimalInput, paginationSchema } from "@/schemas/common";
import { phoneSchema } from "@/schemas/phone";
import { phoneDigits } from "@/lib/phone";
import { ERROR_CODES } from "@/constants/errors";
import { MAP_LINK_MAX_LENGTH } from "@/constants/mapLink";
import { QUICK_SELL_DETAIL_MAX_LENGTH, QUICK_SELL_NAME_MAX_LENGTH } from "@/constants/quickSell";
import {
  CUSTOMER_SUGGESTION_MIN_DIGITS,
  DISCOUNT_TYPES,
  EXCHANGE_SETTLEMENTS,
  LATITUDE_MAX,
  LATITUDE_MIN,
  LONGITUDE_MAX,
  LONGITUDE_MIN,
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

// A discount is a (type, value) pair, both or neither; PERCENT is bounded 0-100, the amount is computed server-side.
interface DiscountFields {
  discountType?: string | null;
  discountValue?: string | null;
}

export function isDiscountConsistent(value: DiscountFields): boolean {
  const hasType = value.discountType !== undefined && value.discountType !== null;
  const hasValue = value.discountValue !== undefined && value.discountValue !== null;
  if (hasType !== hasValue) {
    return false;
  }
  if (!hasType) {
    return true;
  }
  const amount = Number(value.discountValue);
  if (value.discountType === "PERCENT") {
    return amount >= PERCENT_MIN && amount <= PERCENT_MAX;
  }
  return amount >= 0;
}

const discountShape = {
  discountType: z.enum(DISCOUNT_TYPES).nullish(),
  discountValue: decimalInput.nullish(),
};

const DISCOUNT_REFINEMENT = { message: ERROR_CODES.ORDER_DISCOUNT_INVALID } as const;

// Optional delivery map pin: half a coordinate points nowhere, so latitude and longitude come together or not at all.
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

// Money is never taken from the caller except a quick sale's price, which has no catalogue entry (spec.md "Quick sell").
export const quickSellItemSchema = z.object({
  name: z.string().trim().min(1, ERROR_CODES.VALIDATION_REQUIRED).max(QUICK_SELL_NAME_MAX_LENGTH),
  price: decimalInput,
  /** A colour, a size, a number — whatever distinguishes this one piece. */
  detail: z.string().trim().max(QUICK_SELL_DETAIL_MAX_LENGTH).optional(),
});
export type QuickSellItemInput = z.infer<typeof quickSellItemSchema>;

// Exactly one of a catalogue product or a quick sale, checked here so the POS can flag the line before checkout.
export function isOrderItemSourceValid(value: { productId?: string; quickSell?: unknown }): boolean {
  return Boolean(value.productId) !== Boolean(value.quickSell);
}

const ITEM_SOURCE_REFINEMENT = { message: ERROR_CODES.ORDER_ITEM_SOURCE_INVALID } as const;

export const createOrderItemSchema = z
  .object({
    // Optional ONLY because of quick sell: the refinement refuses a line that names neither.
    productId: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED).optional(),
    // Required when the product has variants — the variant owns the price and the stock.
    variantId: z.string().min(1).optional(),
    quickSell: quickSellItemSchema.optional(),
    quantity: z.coerce.number().int().min(1, ERROR_CODES.VALIDATION_INVALID_NUMBER),
    // Credit sales only: the piece stays in the shop until the customer collects it.
    keptInShop: booleanInput.optional(),
    ...discountShape,
  })
  .refine(isDiscountConsistent, DISCOUNT_REFINEMENT)
  .refine(isOrderItemSourceValid, ITEM_SOURCE_REFINEMENT);
export type CreateOrderItemInput = z.infer<typeof createOrderItemSchema>;

// Credit on any channel: a counter sale names its Customer row, an online one is found by its phone; any of them may keep pieces.
export function isCreditConsistent(value: {
  onCredit?: boolean;
  channel: string;
  type?: string;
  customerId?: string;
  paidNow?: string;
  items: { keptInShop?: boolean }[];
}): boolean {
  if (value.onCredit) {
    if (value.type === GIFT_ORDER_TYPE) {
      return false;
    }
    return value.channel !== "STORE" || Boolean(value.customerId);
  }
  return value.paidNow === undefined && value.items.every((item) => !item.keptInShop);
}

export const createOrderSchema = z
  .object({
    channel: z.enum(ORDER_CHANNELS),
    // A GIFT needs order.createGift, checked on the backend — the type here only says what is asked for.
    type: z.enum(ORDER_TYPES).default("SALE"),
    paymentMethod: z.enum(PAYMENT_METHODS).default("CASH"),
    items: z.array(createOrderItemSchema).min(1, ERROR_CODES.ORDER_ITEMS_REQUIRED),
    customerName: z.string().min(1).optional(),
    customerPhone: phoneSchema.optional(),
    customerWhatsapp: phoneSchema.optional(),
    customerAddress: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
    // A credit sale (spec.md "Customers and selling on credit"): any channel, never a gift.
    onCredit: booleanInput.optional(),
    customerId: z.string().min(1).optional(),
    // What the customer pays on the spot; zero is allowed, more than the total is refused on the backend.
    paidNow: decimalInput.optional(),
    ...locationShape,
    ...discountShape,
  })
  .refine(isDiscountConsistent, DISCOUNT_REFINEMENT)
  .refine(isLocationConsistent, LOCATION_REFINEMENT)
  .refine(isCreditConsistent, { message: ERROR_CODES.ORDER_CREDIT_INVALID })
  // An online order must be deliverable back to someone; a STORE sale is handed over at the counter.
  .refine(
    (v) =>
      !(ONLINE_ORDER_CHANNELS as readonly string[]).includes(v.channel) || Boolean(v.customerName && v.customerPhone),
    { message: ERROR_CODES.ORDER_CUSTOMER_REQUIRED },
  );

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// No adding/removing lines (cancel and re-take so committed stock stays traceable); `{ id }` alone clears a line's discount.
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

export const resolveMapLinkSchema = z.object({
  url: z.string().trim().min(1).max(MAP_LINK_MAX_LENGTH).url(ERROR_CODES.ORDER_LOCATION_LINK_INVALID),
});
export type ResolveMapLinkInput = z.infer<typeof resolveMapLinkSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

// Omit `items` to return the whole order; pass them to return specific lines partially.
export const returnOrderItemSchema = z.object({
  orderItemId: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  quantity: z.coerce.number().int().min(1, ERROR_CODES.VALIDATION_INVALID_NUMBER),
});
export type ReturnOrderItemInput = z.infer<typeof returnOrderItemSchema>;

export const returnOrderSchema = z.object({
  items: z.array(returnOrderItemSchema).min(1).optional(),
});
export type ReturnOrderInput = z.infer<typeof returnOrderSchema>;

// An exchange (spec.md "Exchanges"): pieces back from the order, new catalogue pieces out, and how the difference was settled.
export const exchangePreviewSchema = z.object({
  returnItems: z.array(returnOrderItemSchema).min(1, ERROR_CODES.ORDER_ITEMS_REQUIRED),
});
export type ExchangePreviewInput = z.infer<typeof exchangePreviewSchema>;

export const exchangeOrderSchema = z
  .object({
    returnItems: z.array(returnOrderItemSchema).min(1, ERROR_CODES.ORDER_ITEMS_REQUIRED),
    items: z.array(createOrderItemSchema).min(1, ERROR_CODES.ORDER_ITEMS_REQUIRED),
    settlement: z.enum(EXCHANGE_SETTLEMENTS),
    // DEBT only: who owes it; defaults to the original sale's customer.
    customerId: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
    ...discountShape,
  })
  .refine(isDiscountConsistent, DISCOUNT_REFINEMENT)
  .refine((v) => v.items.every((item) => !item.quickSell), { message: ERROR_CODES.ORDER_EXCHANGE_QUICK_SELL })
  .refine((v) => v.items.every((item) => !item.keptInShop), { message: ERROR_CODES.ORDER_CREDIT_INVALID });
export type ExchangeOrderInput = z.infer<typeof exchangeOrderSchema>;

// Settling up with the delivery company: the ids of the orders it just paid for, always a bounded list.
export const collectOrdersSchema = z.object({
  orderIds: z
    .array(z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED))
    .min(1, ERROR_CODES.VALIDATION_REQUIRED)
    .max(MAX_BULK_COLLECT_ORDERS, ERROR_CODES.VALIDATION_INVALID_NUMBER),
});
export type CollectOrdersInput = z.infer<typeof collectOrdersSchema>;

// Autocomplete, not a paginated list: capped at CUSTOMER_SUGGESTION_LIMIT server-side.
export const customerSuggestionsQuerySchema = z.object({
  q: z
    .string()
    .refine((v) => phoneDigits(v).length >= CUSTOMER_SUGGESTION_MIN_DIGITS, ERROR_CODES.VALIDATION_INVALID_PHONE),
});
export type CustomerSuggestionsQuery = z.infer<typeof customerSuggestionsQuerySchema>;

export const listOrdersQuerySchema = paginationSchema.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  channel: z.enum(ORDER_CHANNELS).optional(),
  // Sales or gifts; unset means both — the list records everything that left the shop.
  type: z.enum(ORDER_TYPES).optional(),
  // Drives the outstanding view: this filter set to PENDING_COLLECTION.
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  // A cancelled or fully returned order owes nothing, so it must not sit in the outstanding list.
  collectableOnly: booleanInput.optional(),
  // The quick-sale review list (spec.md "Quick sell"); unset lists everything.
  hasQuickSale: booleanInput.optional(),
  // Only exchanges (their new orders); unset lists everything.
  isExchange: booleanInput.optional(),
  // Orders holding a piece with this barcode or SKU — how the till finds the sale a piece came from.
  itemCode: z.string().trim().min(1).optional(),
  // Inclusive date range over createdAt.
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  // Order number, customer name or customer phone.
  q: z.string().min(1).optional(),
  sortBy: z.enum(ORDER_SORT_FIELDS).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
