// How often the till re-reads the figures another till can change under it,
// and what counts as "the till is being used".
//
// This is a staleness reducer, NOT a correctness mechanism. Two tills can
// still reach for the last piece inside the same interval; what stops one of
// them selling air is the atomic stock check the backend does inside the
// checkout transaction (ORDER_INSUFFICIENT_STOCK). Shortening the interval
// narrows the window and never closes it, so there is nothing to be gained by
// setting it aggressively low.

// The one number to tune. Half a minute is short enough that a cashier
// reaching for the second-to-last piece is looking at a figure from this
// customer rather than the last one, and long enough that a shop running
// three tills over mobile data is making two requests a minute per till
// rather than a stream of them.
export const STOCK_POLL_INTERVAL_MS = 30_000;

// How long a window may sit unfocused-but-visible before the till is treated
// as idle and the polling stops.
//
// Not zero, on purpose: the counter's laptop loses window focus constantly
// and briefly — a barcode scanner grabbing the keyboard, a dialog from
// another app, the cashier glancing at a spreadsheet. Stopping on every one
// of those would mean a refetch storm every time focus came back. A minute
// is well past "they looked away" and well short of "they went home".
export const INACTIVE_AFTER_BLUR_MS = 60_000;
