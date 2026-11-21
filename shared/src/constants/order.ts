import type { OrderStatus } from "@/types/order";

// STORE is a POS sale with the customer present, so it is finished on creation; the others go through delivery.
export const ORDER_CHANNELS = ["STORE", "WHATSAPP", "WEBSITE"] as const;

// What the order IS, a separate axis from channel so reporting can drop gifts from sales without dropping STORE.
export const ORDER_TYPES = ["SALE", "GIFT"] as const;

export const SALE_ORDER_TYPE = "SALE";
export const GIFT_ORDER_TYPE = "GIFT";

// The POS hands a gift over at the counter; a gift may also be sent over WhatsApp, and either way nothing is owed.
export const GIFT_ORDER_CHANNEL = "STORE";

// Remote channels: customer contact details are required, and stock is only committed once preparation starts.
export const ONLINE_ORDER_CHANNELS = ["WHATSAPP", "WEBSITE"] as const;

export const ORDER_STATUSES = ["NEW", "PREPARING", "HANDED_TO_COURIER", "COMPLETED", "CANCELLED", "RETURNED"] as const;

// Cash only for now, modeled as an enum so card/transfer can be added later without restructuring.
export const PAYMENT_METHODS = ["CASH"] as const;

// Selling and being paid are separate moments: a courier parcel is money the delivery company still owes.
export const PAYMENT_STATUSES = ["PENDING_COLLECTION", "COLLECTED"] as const;

export const DISCOUNT_TYPES = ["PERCENT", "AMOUNT"] as const;

// A STORE sale is already paid and handed over, so it opens completed.
export const STORE_ORDER_INITIAL_STATUS = "COMPLETED";
export const ONLINE_ORDER_INITIAL_STATUS = "NEW";

// A counter sale is paid on the spot; a courier order is collected once the delivery company settles up.
export const STORE_ORDER_INITIAL_PAYMENT_STATUS = "COLLECTED";
// An unpaid order older than this is chased first on the collection page.
export const COLLECTION_OVERDUE_DAYS = 7;

export const ONLINE_ORDER_INITIAL_PAYMENT_STATUS = "PENDING_COLLECTION";

// Online orders commit stock when preparation starts — an unanswered WhatsApp order must not hold an item.
export const ONLINE_STOCK_DEDUCTION_STATUS = "PREPARING";

// The only legal moves for backend and frontends; RETURNED only via the returns endpoint; no HANDED_TO_COURIER -> COMPLETED.
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: ["PREPARING", "CANCELLED"],
  PREPARING: ["HANDED_TO_COURIER", "CANCELLED"],
  HANDED_TO_COURIER: ["RETURNED"],
  COMPLETED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

// A finished sale either channel: reporting should count these two together, not COMPLETED alone.
export const FINISHED_ORDER_STATUSES = ["HANDED_TO_COURIER", "COMPLETED"] as const;

// The goods must have left the shop first, and a partially returned order can be returned again.
export const RETURNABLE_ORDER_STATUSES = ["HANDED_TO_COURIER", "COMPLETED", "RETURNED"] as const;

// A cancelled or fully returned sale owes nothing, so it is neither outstanding nor in the pending-collection total.
export const COLLECTABLE_ORDER_STATUSES = ["NEW", "PREPARING", "HANDED_TO_COURIER", "COMPLETED"] as const;

// Once cancelled or (fully) returned an order is a closed record — its contents can no longer be edited.
export const UNEDITABLE_ORDER_STATUSES = ["CANCELLED", "RETURNED"] as const;

export const ORDER_SORT_FIELDS = ["createdAt", "orderNumber", "total", "status"] as const;

// Bulk is normal (the courier pays for a run of parcels), but still a bounded list (CLAUDE.md rule 15).
export const MAX_BULK_COLLECT_ORDERS = 100;

// Money is Decimal(10,2); every computed amount is rounded to this many places before it is written or returned.
export const MONEY_DECIMAL_PLACES = 2;

export const PERCENT_MIN = 0;
export const PERCENT_MAX = 100;

// Order.orderNumber is 32-bit — the ceiling for reading digits in a search box as an order number.
export const MAX_INT32 = 2_147_483_647;

// Phone autocomplete reads past orders' snapshots (no Customer table); fewer digits match half the history.
export const CUSTOMER_SUGGESTION_MIN_DIGITS = 5;
// A phone screen shows a handful without scrolling; beyond that the cashier is better off finishing the number.
export const CUSTOMER_SUGGESTION_LIMIT = 5;
// Bounded scan before collapsing to one entry per customer, so a weekly regular can't push everyone else out.
export const CUSTOMER_SUGGESTION_SCAN_LIMIT = 100;

// Optional map pin alongside a delivery address (spec.md "Customer information"), in WGS84 degrees.
export const LATITUDE_MIN = -90;
export const LATITUDE_MAX = 90;
export const LONGITUDE_MIN = -180;
export const LONGITUDE_MAX = 180;
