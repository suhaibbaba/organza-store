export const INVENTORY_SORT_FIELDS = ["stock", "sku", "createdAt"] as const;

// CLAUDE.md rule 14: never hard-code the low-stock threshold — this is only
// the fallback used before the Setting singleton row/query is available.
export const DEFAULT_LOW_STOCK_THRESHOLD = 3;
