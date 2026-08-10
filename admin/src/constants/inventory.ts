import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@organza/shared/constants/pagination";
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

// How long the +/- presses may keep coming before the run is treated as
// finished and sent as ONE change.
//
// Long enough to cover the gap between two deliberate taps — somebody
// counting a rail of ten pieces presses about twice a second — and short
// enough that letting go and looking at the row shows it saved rather than
// still thinking about it. A press during the wait restarts the clock, so a
// run of any length is still one request and one audit entry.
export const STOCK_SAVE_DEBOUNCE_MS = 900;

// How long the row says "saved" afterwards. Comfortably longer than the
// refetch that follows, so the confirmation never disappears before the
// figure it is confirming has come back from the server.
export const STOCK_SAVED_FLASH_MS = 2500;

// How long a failed save keeps explaining itself. Longer than a success —
// the value has just been put back to what the server holds, and that is
// worth reading before it goes.
export const STOCK_ERROR_FLASH_MS = 6000;
