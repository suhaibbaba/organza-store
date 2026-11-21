import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@store/shared/constants/pagination";
import type { InventoryListFilters } from "@/types/inventory";
import { INVENTORY_SORT_FIELDS } from "@store/shared/constants/inventory";
import { SORT_DIRECTIONS } from "@store/shared/constants/pagination";
import { urlParam } from "@/lib/url-filters";
import type { UrlParams } from "@/types/urlFilters";

export const INVENTORY_SEARCH_DEBOUNCE_MS = 250;

export const INVENTORY_LIST_QUERY_KEY = "inventory" as const;

// Lowest stock first: staff open this screen to see what needs restocking.
export const DEFAULT_INVENTORY_FILTERS: InventoryListFilters = {
  q: "",
  categoryId: null,
  lowStock: false,
  sortBy: "stock",
  sortDir: "asc",
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_PAGE_SIZE,
};

export const INVENTORY_THUMB_SIZES = "(max-width: 767px) 80px, 64px";

export const INVENTORY_LIST_URL_PARAMS: UrlParams<InventoryListFilters> = {
  q: urlParam.text(),
  categoryId: urlParam.id(),
  lowStock: urlParam.flag(),
  sortBy: urlParam.oneOf(INVENTORY_SORT_FIELDS),
  sortDir: urlParam.oneOf(SORT_DIRECTIONS),
  page: urlParam.page(),
  pageSize: urlParam.pageSize(),
};
