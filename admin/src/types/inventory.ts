import type { InventoryItem } from "@organza/shared/types/inventory";
import type { ListInventoryQuery } from "@organza/shared/schemas/inventory";

// Client-side filter state for the inventory list screen — mirrors
// `ListInventoryQuery` (the API's validated query shape) but keeps
// "unset" filters distinct from the schema's own defaults.
export interface InventoryListFilters {
  q: string;
  categoryId: string | null;
  lowStock: boolean;
  sortBy: ListInventoryQuery["sortBy"];
  sortDir: ListInventoryQuery["sortDir"];
  page: number;
}

// A stock change the user has dialled in but the server may not have yet.
//
// The +/- buttons move a draft, not the database: a run of presses settles
// into ONE request (constants/inventory.ts → STOCK_SAVE_DEBOUNCE_MS), so
// raising 0 to 10 writes a single audited change of 0 → 10 rather than ten
// fragments.
export type StockEditStatus = "pending" | "saving" | "saved" | "error";

export interface StockEdit {
  // Where the presses have got to. Shown everywhere the quantity is shown —
  // the figure, the badge, the colour — so the row keeps up with the finger.
  value: number;
  // What the server held before this run of presses began. What a failed
  // save reverts to, and what makes the one audit entry read "0 → 10".
  baseline: number;
  status: StockEditStatus;
  // Set only while `status` is "error", so the row can say what went wrong.
  errorCode?: string;
}

// One line of the inventory list as the screen actually needs it: the item,
// the quantity to display (the draft while one is in flight), whatever the
// save is doing, and whether the row is only still here because the user's
// own edit pushed it out of the active filter.
export interface InventoryRow {
  item: InventoryItem;
  stock: number;
  edit: StockEdit | null;
  isOutsideFilter: boolean;
}
