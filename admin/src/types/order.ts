import type { I18n } from "@organza/shared/types/common";
import type { ListOrdersQuery } from "@organza/shared/schemas/order";
import type { DiscountType, OrderChannel, OrderStatus, PaymentStatus } from "@organza/shared/types/order";

// Client-side filter state for the orders list screen — mirrors
// `ListOrdersQuery` (the API's validated query shape) but keeps "unset"
// filters distinct from the schema's own defaults, and holds the date range
// as the `yyyy-mm-dd` strings a native date input speaks.
export interface OrderListFilters {
  q: string;
  status: OrderStatus | null;
  channel: OrderChannel | null;
  // Whether the money is in yet. The outstanding-money screen is this filter
  // set to PENDING_COLLECTION.
  paymentStatus: PaymentStatus | null;
  // Narrows a payment filter to sales that can still be settled — a cancelled
  // or fully returned order owes nothing and must not pad the amount the shop
  // is waiting on.
  collectableOnly: boolean;
  dateFrom: string;
  dateTo: string;
  sortBy: ListOrdersQuery["sortBy"];
  sortDir: ListOrdersQuery["sortDir"];
  page: number;
}

// A (type, value) discount pair, at either level. Both null = no discount;
// the two always move together (the create-order schema refuses a half-set
// pair — see isDiscountConsistent).
export interface DiscountState {
  type: DiscountType | null;
  value: string | null;
}

// One line of an order being entered by hand. Everything needed to render the
// line is copied in when it is added, so editing quantities never re-fetches.
//
// These copies are for display only: the order API is sent nothing but ids,
// quantities and discounts and re-reads the price and name itself
// (backend/src/lib/orderPricing.ts), so a stale price here can never become a
// wrong order — only a figure worth refreshing.
export interface OrderDraftLine {
  // productId, or productId + variantId — the identity of a sellable thing.
  // Adding the same item twice bumps the existing line rather than stacking a
  // duplicate.
  key: string;
  productId: string;
  variantId: string | null;
  name: I18n;
  variantName: I18n | null;
  sku: string | null;
  imageUrl: string | null;
  unitPrice: string;
  // What the catalogue held when the line was added, used to stop the user
  // building an order the backend will reject. The backend's atomic stock
  // guard remains the real check.
  availableStock: number;
  quantity: number;
  discountType: DiscountType | null;
  discountValue: string | null;
}

// Everything the totals panel needs, all as fixed-2dp strings so they can go
// straight to the currency formatter.
export interface OrderDraftTotals {
  itemCount: number;
  // Sum of line totals, item discounts already applied.
  subtotal: string;
  // What the item-level discounts took off, summed — shown so the saving is
  // visible, since it is already baked into the subtotal.
  itemDiscountTotal: string;
  // What the order-level discount takes off the subtotal.
  orderDiscountAmount: string;
  total: string;
}

// The customer snapshot captured on a manually entered online order. There is
// no Customer entity yet (spec.md "Customer information") — these fields are
// copied onto the order itself.
export interface OrderCustomerDraft {
  name: string;
  phone: string;
  whatsapp: string;
  address: string;
  // Optional map pin, kept as typed text so a half-entered coordinate can sit
  // in the field without becoming a number.
  latitude: string;
  longitude: string;
  note: string;
}

// How much of each line a return is taking back, keyed by order item id.
// Absent or 0 = that line isn't part of this return.
export type ReturnQuantities = Record<string, number>;
