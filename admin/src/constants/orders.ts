import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@store/shared/constants/pagination";
import type { IconName, SectionTone } from "@store/ui";
import type { OrderListFilters } from "@/types/order";
import { ORDER_CHANNELS, ORDER_SORT_FIELDS, ORDER_STATUSES, PAYMENT_STATUSES } from "@store/shared/constants/order";
import { SORT_DIRECTIONS } from "@store/shared/constants/pagination";
import { urlParam } from "@/lib/url-filters";
import type { UrlParams } from "@/types/urlFilters";

export const ORDER_LIST_QUERY_KEY = "orders" as const;
export const ORDER_DETAIL_QUERY_KEY = "order" as const;
export const ORDER_EXCHANGE_PREVIEW_QUERY_KEY = "orderExchangePreview" as const;
export const ORDER_COLLECTION_SUMMARY_QUERY_KEY = ["orders", "collectionSummary"] as const;

export const ORDER_SEARCH_DEBOUNCE_MS = 400;

export const ORDER_THUMB_SIZES = "(max-width: 767px) 64px, 48px";

// Newest first: staff open this screen to deal with what just came in.
export const DEFAULT_ORDER_FILTERS: OrderListFilters = {
  q: "",
  status: null,
  channel: null,
  paymentStatus: null,
  collectableOnly: false,
  hasQuickSale: false,
  isExchange: false,
  dateFrom: "",
  dateTo: "",
  sortBy: "createdAt",
  sortDir: "desc",
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_PAGE_SIZE,
};

// What the courier still holds cash for, oldest first: the longest-owed money is chased first.
export const COLLECTION_ORDER_FILTERS: OrderListFilters = {
  ...DEFAULT_ORDER_FILTERS,
  paymentStatus: "PENDING_COLLECTION",
  collectableOnly: true,
  sortBy: "createdAt",
  sortDir: "asc",
};

// Each option pairs a (sortBy, sortDir) combination with a message key under `orders.sort.*`.
export const ORDER_SORT_OPTIONS = [
  { value: "createdAt-desc", sortBy: "createdAt", sortDir: "desc", labelKey: "newest" },
  { value: "createdAt-asc", sortBy: "createdAt", sortDir: "asc", labelKey: "oldest" },
  { value: "total-desc", sortBy: "total", sortDir: "desc", labelKey: "totalHighToLow" },
  { value: "total-asc", sortBy: "total", sortDir: "asc", labelKey: "totalLowToHigh" },
  { value: "orderNumber-desc", sortBy: "orderNumber", sortDir: "desc", labelKey: "numberDesc" },
  { value: "orderNumber-asc", sortBy: "orderNumber", sortDir: "asc", labelKey: "numberAsc" },
] as const;

// The online status flow (spec.md "Status flow"); the legal moves come from ORDER_STATUS_TRANSITIONS.
export const ONLINE_ORDER_FLOW = ["NEW", "PREPARING", "HANDED_TO_COURIER"] as const;

// Where an order typed in the admin came from; WEBSITE arrives from the storefront in Phase 3.
export const MANUAL_ORDER_CHANNELS = ["WHATSAPP", "STORE"] as const;
export const DEFAULT_MANUAL_ORDER_CHANNEL = "WHATSAPP" as const;

export const ORDER_FORM_SECTIONS = {
  products: { icon: "package", tone: "amber" },
  customer: { icon: "user", tone: "blue" },
  kind: { icon: "receipt", tone: "violet" },
  summary: { icon: "money", tone: "green" },
  note: { icon: "file", tone: "neutral" },
  credit: { icon: "wallet", tone: "rose" },
  returning: { icon: "reset", tone: "violet" },
  settlement: { icon: "coins", tone: "green" },
} as const satisfies Record<string, { icon: IconName; tone: SectionTone }>;

export type OrderFormSectionName = keyof typeof ORDER_FORM_SECTIONS;

// Every gift line is priced at zero, not discounted 100% (spec.md "Gifts").
export const GIFT_LINE_TOTAL = "0";
export const MANUAL_ORDER_PAYMENT_METHOD = "CASH" as const;
export const EMPTY_ORDER_CREDIT = { onCredit: false, customer: null, paidNow: "", keptKeys: [] } as const;

// What staff are offered first on each side of an exchange: the difference changing hands in cash.
export const DEFAULT_CUSTOMER_PAYS_SETTLEMENT = "PAID" as const;
export const DEFAULT_SHOP_PAYS_SETTLEMENT = "REFUNDED" as const;

// The backend re-checks stock atomically (ORDER_INSUFFICIENT_STOCK); this only avoids a doomed order.
export const MIN_ORDER_QUANTITY = 1;

export const ORDER_PRODUCT_SEARCH_DEBOUNCE_MS = 250;
// A pasted short Maps link resolves at once in practice; typing one waits for the pause.
export const MAP_LINK_RESOLVE_DEBOUNCE_MS = 400;
export const ORDER_PRODUCT_SEARCH_PAGE = DEFAULT_PAGE;
export const ORDER_PRODUCT_SEARCH_PAGE_SIZE = 12;
export const ORDER_PRODUCT_SEARCH_MIN_QUERY_LENGTH = 1;

// Hidden products are not for sale, so the picker never shows them.
export const ORDER_PRODUCT_SEARCH_STATUS = "active" as const;

export const COORDINATE_DECIMALS = 6;

export const ORDER_LIST_URL_PARAMS: UrlParams<OrderListFilters> = {
  q: urlParam.text(),
  status: urlParam.optionalOneOf(ORDER_STATUSES),
  channel: urlParam.optionalOneOf(ORDER_CHANNELS),
  paymentStatus: urlParam.optionalOneOf(PAYMENT_STATUSES),
  collectableOnly: urlParam.fixed(),
  hasQuickSale: urlParam.flag(),
  isExchange: urlParam.flag(),
  dateFrom: urlParam.text(),
  dateTo: urlParam.text(),
  sortBy: urlParam.oneOf(ORDER_SORT_FIELDS),
  sortDir: urlParam.oneOf(SORT_DIRECTIONS),
  page: urlParam.page(),
  pageSize: urlParam.pageSize(),
};

// The collection screen is unpaid-only, so its payment filter is never read from the URL.
export const COLLECTION_ORDER_URL_PARAMS: UrlParams<OrderListFilters> = {
  ...ORDER_LIST_URL_PARAMS,
  paymentStatus: urlParam.fixed(),
};
