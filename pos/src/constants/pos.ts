import { DEFAULT_PAGE } from "@shared/constants/pagination";

// The selling screen is used all day at the counter, so search has to feel
// instant: a short debounce (the backend search is already fast) and a small
// page of big, tappable results rather than a scrollable list nobody reads
// past.
export const SEARCH_DEBOUNCE_MS = 250;
export const SEARCH_PAGE = DEFAULT_PAGE;
export const SEARCH_PAGE_SIZE = 12;
// Below this, a query is almost always still being typed.
export const SEARCH_MIN_QUERY_LENGTH = 1;

// Sale channel + payment for everything the POS rings up: a counter sale,
// paid in cash, completed the moment it is created (spec.md "Phase 2:
// Orders"). Modeled as constants rather than inlined so adding e.g. a card
// payment later is one edit here.
export const POS_ORDER_CHANNEL = "STORE" as const;
export const POS_PAYMENT_METHOD = "CASH" as const;

// A cart line's quantity: at least one piece, and never more than the store
// actually holds — the backend re-checks stock atomically at checkout
// (ORDER_INSUFFICIENT_STOCK), this only keeps the counter from building a
// cart that is guaranteed to fail.
export const MIN_CART_QUANTITY = 1;

// How long the "sale completed" panel stays before the screen resets itself
// for the next customer. Long enough to read the order number aloud, short
// enough that the till is never left sitting on a finished sale.
export const SALE_SUCCESS_RESET_MS = 6000;

// A scanned barcode arriving while the previous one is still being looked up
// is almost always the same item read twice by the camera. Ignore repeats of
// the same code inside this window.
export const SCAN_DEDUPE_MS = 1500;

// Scan region for the scanner (html5-qrcode's `qrbox`), as a fraction of
// the live viewfinder rather than as fixed pixels: html5-qrcode only decodes
// what falls INSIDE this box, and a 1D barcode on a clothing tag is nearly
// as wide as the frame. A fixed 260px box silently clips the ends of the
// barcode on a phone whose camera feed is wider than that, and nothing ever
// scans — so the box tracks the viewfinder's own size instead.
//
// Wide and short for the same reason: a barcode is far wider than it is
// tall, and a square box just makes staff hunt for the right distance.
export const SCANNER_BOX_WIDTH_RATIO = 0.92;
export const SCANNER_BOX_HEIGHT_RATIO = 0.5;
export const SCANNER_FPS = 10;
// html5-qrcode renders its video into the element with this id.
export const SCANNER_ELEMENT_ID = "pos-barcode-scanner";
