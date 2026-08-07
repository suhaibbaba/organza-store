export const INVENTORY_SORT_FIELDS = ["stock", "sku", "createdAt"] as const;

// CLAUDE.md rule 14: never hard-code the low-stock threshold — this is only
// the fallback used before the Setting singleton row/query is available.
export const DEFAULT_LOW_STOCK_THRESHOLD = 3;

// The three things a quantity can mean to whoever is looking at it: there is
// none, there is nearly none, there is some. Every screen in every app that
// shows stock or availability answers with one of these — the POS search
// results, the variant picker, the cart, the admin inventory — so the same
// quantity is never green on one screen and amber on the next.
//
// The colour that goes with each (red / amber / green) is a token in each
// app's stylesheet, not a value here: this package has no styling in it.
export const STOCK_STATUSES = ["OUT", "LOW", "IN"] as const;
