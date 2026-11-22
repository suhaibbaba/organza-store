import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@store/shared/constants/pagination";
import { CUSTOMER_SORT_FIELDS } from "@store/shared/constants/customer";
import { urlParam } from "@/lib/url-filters";
import type { CustomerListFilters } from "@/types/customer";
import type { UrlParams } from "@/types/urlFilters";

export const CUSTOMER_LIST_QUERY_KEY = "customers.list";
export const CUSTOMER_DETAIL_QUERY_KEY = "customers.detail";
export const CUSTOMER_PAYMENT_PREVIEW_QUERY_KEY = "customers.paymentPreview";
export const CUSTOMER_STALE_TIME_MS = 30 * 1000;
export const CUSTOMER_SEARCH_DEBOUNCE_MS = 300;
export const CUSTOMER_PICKER_PAGE_SIZE = 8;
// Waits for a pause in typing before asking how a customer payment would be split.
export const CUSTOMER_PAYMENT_PREVIEW_DEBOUNCE_MS = 350;

export const DEFAULT_CUSTOMER_FILTERS: CustomerListFilters = {
  q: "",
  owing: false,
  keptPieces: false,
  sortBy: "lastOrderAt",
  sortDir: "desc",
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_PAGE_SIZE,
};

export const CUSTOMER_LIST_URL_PARAMS: UrlParams<CustomerListFilters> = {
  q: urlParam.text(),
  owing: urlParam.flag(),
  keptPieces: urlParam.flag(),
  sortBy: urlParam.oneOf(CUSTOMER_SORT_FIELDS),
  sortDir: urlParam.oneOf(["asc", "desc"] as const),
  page: urlParam.page(),
  pageSize: urlParam.pageSize(),
};
