// Exchanges (spec.md "Exchanges"): finding the original sale and settling the difference at the till.

// Recent sales shown before anything is typed, a page at a time.
export const EXCHANGE_HISTORY_PAGE_SIZE = 10;

export const EXCHANGE_SEARCH_DEBOUNCE_MS = 300;

// Typed text this long in digits is a printed barcode rather than an order number or phone.
export const EXCHANGE_CODE_MIN_DIGITS = 12;

// A SKU (ORG-12-3) has letters and a hyphen; an order number, name or phone never mixes the two like that.
export const EXCHANGE_SKU_PATTERN = /^[A-Za-z]+-\d+(-\d+)?$/;

// How many of a past sale's pieces the history row names before "+N".
export const EXCHANGE_ROW_PREVIEW_ITEMS = 3;

// The default choice for each side of the difference: the common case at a counter.
export const EXCHANGE_DEFAULT_SETTLEMENT = { customer: "PAID", shop: "REFUNDED", even: "EVEN" } as const;
