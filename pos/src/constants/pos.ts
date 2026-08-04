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

// The two ways a cart can be sold. A counter sale is a STORE order: paid in
// cash and completed the moment it is created, customer standing there. The
// same cart can instead be filed as a WhatsApp order, which opens NEW, holds
// no stock until someone starts preparing it, and is paid for by the
// delivery company later (spec.md "Phase 2: Orders") — that is the order a
// cashier would otherwise have to leave the POS to write down.
//
// WEBSITE isn't offered: those orders arrive from the storefront itself in
// Phase 3, nobody types them in.
export const POS_ORDER_CHANNEL = "STORE" as const;
export const WHATSAPP_ORDER_CHANNEL = "WHATSAPP" as const;
export const POS_PAYMENT_METHOD = "CASH" as const;

// Phone autocomplete on the WhatsApp form. Slightly longer than the product
// search debounce: a phone number is typed in one burst, and there is no
// point querying every digit of it. The digit floor and the result cap are
// the backend's (CUSTOMER_SUGGESTION_MIN_DIGITS / _LIMIT) — the same numbers
// decide when to ask and what comes back.
export const CUSTOMER_SUGGESTION_DEBOUNCE_MS = 350;

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
