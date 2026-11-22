import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@store/shared/constants/pagination";
import { SUPPLIER_SORT_FIELDS } from "@store/shared/constants/supplier";
import { urlParam } from "@/lib/url-filters";
import type { SupplierListFilters } from "@/types/supplier";
import type { UrlParams } from "@/types/urlFilters";

export const SUPPLIER_LIST_QUERY_KEY = "suppliers.list";
export const SUPPLIER_DETAIL_QUERY_KEY = "suppliers.detail";
export const SUPPLIER_PAYMENT_PREVIEW_QUERY_KEY = "suppliers.paymentPreview";
export const SUPPLIER_STALE_TIME_MS = 30 * 1000;
export const SUPPLIER_SEARCH_DEBOUNCE_MS = 300;
// Waits for a pause in typing before asking how a payment would be split.
export const SUPPLIER_PAYMENT_PREVIEW_DEBOUNCE_MS = 350;

export const DEFAULT_SUPPLIER_FILTERS: SupplierListFilters = {
  q: "",
  owing: false,
  sortBy: "lastInvoiceAt",
  sortDir: "desc",
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_PAGE_SIZE,
};

export const SUPPLIER_LIST_URL_PARAMS: UrlParams<SupplierListFilters> = {
  q: urlParam.text(),
  owing: urlParam.flag(),
  sortBy: urlParam.oneOf(SUPPLIER_SORT_FIELDS),
  sortDir: urlParam.oneOf(["asc", "desc"] as const),
  page: urlParam.page(),
  pageSize: urlParam.pageSize(),
};
