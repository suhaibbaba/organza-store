import type { ListInventoryQuery } from "@shared/schemas/inventory";

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
