import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@organza/shared/constants/pagination";
import type { OrderListFilters } from "@/types/order";

export const ORDER_LIST_QUERY_KEY = "orders" as const;
export const ORDER_DETAIL_QUERY_KEY = "order" as const;
export const ORDER_COLLECTION_SUMMARY_QUERY_KEY = ["orders", "collectionSummary"] as const;

export const ORDER_LIST_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export const ORDER_SEARCH_DEBOUNCE_MS = 400;

// Newest first: staff open this screen to deal with what just came in.
export const DEFAULT_ORDER_FILTERS: OrderListFilters = {
  q: "",
  status: null,
  channel: null,
  paymentStatus: null,
  collectableOnly: false,
  hasQuickSale: false,
  dateFrom: "",
  dateTo: "",
  sortBy: "createdAt",
  sortDir: "desc",
  page: DEFAULT_PAGE,
};

// The outstanding-money screen is the same order list, pinned to one
// question: which sales is the delivery company still holding cash for?
// Oldest first — the money that has been owed longest is the money to chase.
export const COLLECTION_ORDER_FILTERS: OrderListFilters = {
  ...DEFAULT_ORDER_FILTERS,
  paymentStatus: "PENDING_COLLECTION",
  collectableOnly: true,
  sortBy: "createdAt",
  sortDir: "asc",
};

// Each option pairs a (sortBy, sortDir) combination with a message key under
// `orders.sort.*`.
export const ORDER_SORT_OPTIONS = [
  { value: "createdAt-desc", sortBy: "createdAt", sortDir: "desc", labelKey: "newest" },
  { value: "createdAt-asc", sortBy: "createdAt", sortDir: "asc", labelKey: "oldest" },
  { value: "total-desc", sortBy: "total", sortDir: "desc", labelKey: "totalHighToLow" },
  { value: "total-asc", sortBy: "total", sortDir: "asc", labelKey: "totalLowToHigh" },
  { value: "orderNumber-desc", sortBy: "orderNumber", sortDir: "desc", labelKey: "numberDesc" },
  { value: "orderNumber-asc", sortBy: "orderNumber", sortDir: "asc", labelKey: "numberAsc" },
] as const;

// The delivery pipeline an online order walks, in order (spec.md "Status
// flow"). Drives the progress strip on the detail screen; the legal moves
// themselves come from ORDER_STATUS_TRANSITIONS in shared/, which the backend
// enforces.
export const ONLINE_ORDER_FLOW = ["NEW", "PREPARING", "HANDED_TO_COURIER"] as const;

// An order entered by hand in the admin is a WhatsApp order: that is how
// remote orders reach the shop today (CLAUDE.md "Scope of the CURRENT
// phase"). WEBSITE orders will arrive from the storefront itself in Phase 3,
// so that channel isn't offered here. Cash is the only payment method for now
// (spec.md "Payment"), named rather than inlined so adding another is one
// edit.
export const MANUAL_ORDER_CHANNEL = "WHATSAPP" as const;
export const MANUAL_ORDER_PAYMENT_METHOD = "CASH" as const;

// A draft line's quantity: at least one piece, and never more than the shop
// actually holds — the backend re-checks stock atomically when the order is
// saved (ORDER_INSUFFICIENT_STOCK); this only keeps the user from building an
// order that is guaranteed to fail.
export const MIN_ORDER_QUANTITY = 1;

// Product search inside the order builder. Same feel as the POS: short
// debounce, a small page of big tappable results.
export const ORDER_PRODUCT_SEARCH_DEBOUNCE_MS = 250;
export const ORDER_PRODUCT_SEARCH_PAGE = DEFAULT_PAGE;
export const ORDER_PRODUCT_SEARCH_PAGE_SIZE = 12;
// Below this, a query is almost always still being typed.
export const ORDER_PRODUCT_SEARCH_MIN_QUERY_LENGTH = 1;

// `status=active` keeps hidden products out of the picker — they aren't for
// sale.
export const ORDER_PRODUCT_SEARCH_STATUS = "active" as const;

// Where a map pin links to. A plain coordinate URL rather than an embedded
// map: no API key, no third-party script, and it opens in whatever maps app
// the driver's phone already has (CLAUDE.md "Deployment": no paid services).
export const MAP_LINK_TEMPLATE = "https://www.google.com/maps/search/?api=1&query=";

// Coordinates are Latin-decimal data, not prose — pinned LTR so a minus sign
// stays on the correct side inside an RTL layout.
export const COORDINATE_DECIMALS = 6;
