import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@organza/shared/constants/pagination";
import type { InventoryListFilters } from "@/types/inventory";

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
