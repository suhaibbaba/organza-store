import type { InventoryItem } from "@organza/shared/types/inventory";
import type { ListInventoryQuery } from "@organza/shared/schemas/inventory";

export interface InventoryListFilters {
  q: string;
  categoryId: string | null;
  lowStock: boolean;
  sortBy: ListInventoryQuery["sortBy"];
  sortDir: ListInventoryQuery["sortDir"];
  page: number;
  pageSize: number;
}

// A quantity typed or stepped but not saved yet; `failed` marks one the last Save could not write.
export interface StockDraft {
  item: InventoryItem;
  value: number;
  failed: boolean;
}

export interface InventoryRow {
  item: InventoryItem;
  stock: number;
  changed: boolean;
  failed: boolean;
}
