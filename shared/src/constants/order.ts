import type { OrderStatus } from "@/types/order";

// Where the order came from. STORE is a POS sale rung up with the customer
// standing there, so it is finished the moment it is created; the other two
// are taken remotely and travel through the delivery flow below.
export const ORDER_CHANNELS = ["STORE", "WHATSAPP", "WEBSITE"] as const;

// Channels whose orders are placed remotely: customer contact details are
// required, and stock is only committed once preparation starts.
export const ONLINE_ORDER_CHANNELS = ["WHATSAPP", "WEBSITE"] as const;

export const ORDER_STATUSES = [
  "NEW",
  "PREPARING",
  "DELIVERING",
  "RECEIVED",
  "COMPLETED",
  "CANCELLED",
  "RETURNED",
] as const;

// Cash only for now, modeled as an enum so card/transfer can be added later
// without restructuring (same reasoning as Setting.currency).
export const PAYMENT_METHODS = ["CASH"] as const;

export const DISCOUNT_TYPES = ["PERCENT", "AMOUNT"] as const;

// A STORE sale is already paid and handed over, so it opens completed.
export const STORE_ORDER_INITIAL_STATUS = "COMPLETED";
export const ONLINE_ORDER_INITIAL_STATUS = "NEW";

// Online orders commit stock when preparation starts, not when the order is
// taken — an unanswered WhatsApp order must not hold an item off the shelf.
export const ONLINE_STOCK_DEDUCTION_STATUS = "PREPARING";

// The only legal moves. Both the backend (as the real gate) and the
// frontends (to decide which buttons to show) read this one table.
// CANCELLED is terminal; RETURNED is reached through the returns endpoint,
// never by setting the status directly, so that stock and returnedQuantity
// stay in step.
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: ["PREPARING", "CANCELLED"],
  PREPARING: ["DELIVERING", "CANCELLED"],
  DELIVERING: ["RECEIVED", "CANCELLED"],
  RECEIVED: ["COMPLETED", "RETURNED"],
  COMPLETED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

// Statuses a return can be raised against: the goods have to have reached the
// customer first, and a partially returned order can still be returned again.
export const RETURNABLE_ORDER_STATUSES = ["RECEIVED", "COMPLETED", "RETURNED"] as const;

// Once cancelled or (fully) returned an order is a closed record — its
// contents can no longer be edited.
export const UNEDITABLE_ORDER_STATUSES = ["CANCELLED", "RETURNED"] as const;

export const ORDER_SORT_FIELDS = ["createdAt", "orderNumber", "total", "status"] as const;

// Money is stored as Decimal(10,2) and every computed amount is rounded to
// this many places before it is written or returned.
export const MONEY_DECIMAL_PLACES = 2;

export const PERCENT_MIN = 0;
export const PERCENT_MAX = 100;

// Order.orderNumber is a 32-bit column — the ceiling for treating a run of
// digits in a search box as an order number rather than as text.
export const MAX_INT32 = 2_147_483_647;

// Optional map pin dropped alongside a delivery address (spec.md "Customer
// information"). WGS84 degrees.
export const LATITUDE_MIN = -90;
export const LATITUDE_MAX = 90;
export const LONGITUDE_MIN = -180;
export const LONGITUDE_MAX = 180;
