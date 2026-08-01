// CLAUDE.md rule 14: never hard-code the low-stock threshold — this is only
// the fallback used before the Setting singleton row exists.
export const DEFAULT_LOW_STOCK_THRESHOLD = 3;

export const INVENTORY_SORT_FIELDS = ["stock", "sku", "createdAt"] as const;
