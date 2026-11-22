// Counter search must feel instant: short debounce, small page of big tappable results.
export const SEARCH_DEBOUNCE_MS = 250;

// Browsed by eye, so a page fills the grid; more comes on "Show more", never an unbounded list.
export const BROWSE_PAGE_SIZE = 24;

// STORE: paid in cash, completed at once. WHATSAPP: opens NEW, holds no stock, paid by the courier later.
export const POS_ORDER_CHANNEL = "STORE" as const;
export const WHATSAPP_ORDER_CHANNEL = "WHATSAPP" as const;
export const POS_PAYMENT_METHOD = "CASH" as const;

// The digit floor and result cap match the backend's CUSTOMER_SUGGESTION_MIN_DIGITS / _LIMIT.
export const CUSTOMER_SUGGESTION_DEBOUNCE_MS = 350;
export const CUSTOMER_SEARCH_DEBOUNCE_MS = 300;
export const CUSTOMER_SEARCH_PAGE_SIZE = 6;

// Capped in the box so the cashier finds out while typing, not when the save is refused.
export const GIFT_NOTE_MAX_LENGTH = 200;

// The backend re-checks stock atomically at checkout; this only avoids a cart that is sure to fail.
export const MIN_CART_QUANTITY = 1;

// Long enough to read the order number aloud.
export const SALE_SUCCESS_RESET_MS = 6000;

// The camera reports a held item repeatedly; only repeats of the SAME code inside this window are ignored.
export const SCAN_DEDUPE_MS = 1000;

// Tied to the dedupe window on purpose: the bar shows when the same tag will be read again.
export const SCAN_FLASH_MS = SCAN_DEDUPE_MS;

export const SCAN_PULSE_MS = 450;

// Counter laptop with a plug-in barcode scanner: keyboard only, so nothing here affects the phone.

// A scanner types the code and presses Enter; read by event.code so the keyboard layout doesn't matter.
export const HARDWARE_SCAN_MAX_KEY_GAP_MS = 40;

// Above what a stray keypress or two could reach.
export const HARDWARE_SCAN_MIN_LENGTH = 4;

// Enter is the factory default; Tab and NumpadEnter cover scanners already configured that way.
export const HARDWARE_SCAN_TERMINATOR_CODES: readonly string[] = ["Enter", "NumpadEnter", "Tab"];

// Not plain letters: a letter can start a code the scanner is typing.
export const SELL_SHORTCUT_FOCUS_SEARCH = "/";
export const SELL_SHORTCUT_SCAN = "F2";
export const SELL_SHORTCUT_CHECKOUT = "F9";
export const SELL_SHORTCUT_CLEAR = "Escape";

// Also matched by key position: on an Arabic layout the "/" key types ظ.
export const SELL_SHORTCUT_FOCUS_SEARCH_CODE = "Slash";

// A fraction of the viewfinder: html5-qrcode only decodes inside the box, and a tag barcode is nearly frame-wide.
export const SCANNER_BOX_WIDTH_RATIO = 0.92;
export const SCANNER_BOX_HEIGHT_RATIO = 0.5;
export const SCANNER_FPS = 10;
// html5-qrcode renders its video into the element with this id.
export const SCANNER_ELEMENT_ID = "pos-barcode-scanner";

// Every sale starts as the everyday one: handed over in the shop, paid now.
export const DEFAULT_CHECKOUT_CHOICE = { channel: "STORE", payment: "paid", gift: false } as const;
