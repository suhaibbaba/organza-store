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
  "HANDED_TO_COURIER",
  "COMPLETED",
  "CANCELLED",
  "RETURNED",
] as const;

// Cash only for now, modeled as an enum so card/transfer can be added later
// without restructuring (same reasoning as Setting.currency).
export const PAYMENT_METHODS = ["CASH"] as const;

// Selling and being paid are two different moments for this shop. A counter
// sale is cash in hand; a parcel handed to the delivery company is money the
// company still owes, sometimes for weeks. Tracking that separately from the
// order's status is what keeps "what we sold" and "what we actually hold"
// from being confused with each other.
export const PAYMENT_STATUSES = ["PENDING_COLLECTION", "COLLECTED"] as const;

export const DISCOUNT_TYPES = ["PERCENT", "AMOUNT"] as const;

// A STORE sale is already paid and handed over, so it opens completed.
export const STORE_ORDER_INITIAL_STATUS = "COMPLETED";
export const ONLINE_ORDER_INITIAL_STATUS = "NEW";

// The money side of the same split: a counter sale is paid in cash on the
// spot, while an order that leaves with the courier is only collected once
// the delivery company settles up (an Admin/Manager records that).
export const STORE_ORDER_INITIAL_PAYMENT_STATUS = "COLLECTED";
export const ONLINE_ORDER_INITIAL_PAYMENT_STATUS = "PENDING_COLLECTION";

// Online orders commit stock when preparation starts, not when the order is
// taken — an unanswered WhatsApp order must not hold an item off the shelf.
export const ONLINE_STOCK_DEDUCTION_STATUS = "PREPARING";

// The only legal moves. Both the backend (as the real gate) and the
// frontends (to decide which buttons to show) read this one table.
//
// The two channels end in different places, per spec.md's status flow: an
// online order finishes at HANDED_TO_COURIER — the shop's involvement ends
// when the parcel is given to the delivery company, and it does not track
// the drive to the customer's door — while COMPLETED belongs to a STORE
// sale, which opens there. There is deliberately no HANDED_TO_COURIER ->
// COMPLETED move; see FINISHED_ORDER_STATUSES below for the "this sale is
// done" test that reporting should use.
//
// CANCELLED is terminal; RETURNED is reached through the returns endpoint,
// never by setting the status directly, so that stock and returnedQuantity
// stay in step. A parcel the customer refuses comes back the same way.
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: ["PREPARING", "CANCELLED"],
  PREPARING: ["HANDED_TO_COURIER", "CANCELLED"],
  HANDED_TO_COURIER: ["RETURNED"],
  COMPLETED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

// A finished sale, whichever channel it came through: HANDED_TO_COURIER for
// an online order, COMPLETED for a counter sale. Sales and profit reporting
// should count these two together rather than keying off COMPLETED alone.
export const FINISHED_ORDER_STATUSES = ["HANDED_TO_COURIER", "COMPLETED"] as const;

// Statuses a return can be raised against: the goods have to have left the
// shop first, and a partially returned order can still be returned again.
export const RETURNABLE_ORDER_STATUSES = ["HANDED_TO_COURIER", "COMPLETED", "RETURNED"] as const;

// Statuses whose money can still be collected. A cancelled or fully returned
// sale owes the shop nothing, so it neither appears in the outstanding view
// nor counts towards the pending-collection total.
export const COLLECTABLE_ORDER_STATUSES = ["NEW", "PREPARING", "HANDED_TO_COURIER", "COMPLETED"] as const;

// Once cancelled or (fully) returned an order is a closed record — its
// contents can no longer be edited.
export const UNEDITABLE_ORDER_STATUSES = ["CANCELLED", "RETURNED"] as const;

export const ORDER_SORT_FIELDS = ["createdAt", "orderNumber", "total", "status"] as const;

// How many orders one "mark collected" action may settle at once. The shop
// settles a batch when the delivery company pays for a run of parcels, so
// bulk is the normal case — but it is still a bounded list, like every other
// input the API accepts (CLAUDE.md rule 15).
export const MAX_BULK_COLLECT_ORDERS = 100;

// Money is stored as Decimal(10,2) and every computed amount is rounded to
// this many places before it is written or returned.
export const MONEY_DECIMAL_PLACES = 2;

export const PERCENT_MIN = 0;
export const PERCENT_MAX = 100;

// Order.orderNumber is a 32-bit column — the ceiling for treating a run of
// digits in a search box as an order number rather than as text.
export const MAX_INT32 = 2_147_483_647;

// Phone autocomplete for repeat customers. There is no Customer table
// (spec.md "Customer information"), so "a customer" is whatever the last
// order under that number wrote down — the suggestions are read back out of
// previous orders' customer snapshots.
//
// Below this many digits a query matches half the shop's history, which is
// noise rather than help; a local mobile number is 9-10 digits, so five is
// roughly the point where the list becomes worth showing.
export const CUSTOMER_SUGGESTION_MIN_DIGITS = 5;
// How many suggestions are ever returned: a phone screen shows a handful
// without scrolling, and beyond that the cashier is better off finishing the
// number than reading a list.
export const CUSTOMER_SUGGESTION_LIMIT = 5;
// How many recent matching orders are read before being collapsed to one
// entry per customer. Bounded like every other query (CLAUDE.md rule 15) —
// a regular buying weekly must not be able to push everyone else out of the
// list, and nothing here is worth an unbounded scan.
export const CUSTOMER_SUGGESTION_SCAN_LIMIT = 100;

// Optional map pin dropped alongside a delivery address (spec.md "Customer
// information"). WGS84 degrees.
export const LATITUDE_MIN = -90;
export const LATITUDE_MAX = 90;
export const LONGITUDE_MIN = -180;
export const LONGITUDE_MAX = 180;
