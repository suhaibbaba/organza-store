import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@shared/constants/pagination";
import type { InventoryListFilters } from "@/types/inventory";

export const INVENTORY_SEARCH_DEBOUNCE_MS = 400;

export const INVENTORY_LIST_QUERY_KEY = "inventory" as const;

export const INVENTORY_LIST_PAGE_SIZE = DEFAULT_PAGE_SIZE;

// Default sort surfaces the most urgent items (lowest stock) first —
// staff open this screen to see what needs restocking.
export const DEFAULT_INVENTORY_FILTERS: InventoryListFilters = {
  q: "",
  categoryId: null,
  lowStock: false,
  sortBy: "stock",
  sortDir: "asc",
  page: DEFAULT_PAGE,
};
