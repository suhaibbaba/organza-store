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

// The "who is it for / why" line on a gift (spec.md "Gifts"), which rides
// along on the order's own `note`. Capped in the box rather than validated
// after the fact: it is a label on a giveaway, not a paragraph, and a cashier
// should find out it is too long while typing rather than when the save is
// refused. The backend accepts any non-empty string, so this is the shop's
// idea of "short", not a protocol limit.
export const GIFT_NOTE_MAX_LENGTH = 200;

// A cart line's quantity: at least one piece, and never more than the store
// actually holds — the backend re-checks stock atomically at checkout
// (ORDER_INSUFFICIENT_STOCK), this only keeps the counter from building a
// cart that is guaranteed to fail.
export const MIN_CART_QUANTITY = 1;

// How long the "sale completed" panel stays before the screen resets itself
// for the next customer. Long enough to read the order number aloud, short
// enough that the till is never left sitting on a finished sale.
export const SALE_SUCCESS_RESET_MS = 6000;

// The camera reads whatever is in front of it ten times a second, so an item
// held still under it reports the same barcode over and over. Repeats of the
// SAME code inside this window are ignored; a different code is never
// delayed, because scanning a pile of items one after another is the normal
// case and any wait there would be felt on every single item.
//
// About a second is the smallest window that reliably covers "lift this tag
// away and bring the next one in", while still being short enough that
// deliberately re-scanning one item to add a second piece just works.
export const SCAN_DEDUPE_MS = 1000;

// How long the scanned cart line stays lit, and how long its little bar
// takes to run down. Tied to the window above on purpose: what the bar is
// showing IS the window, so the cashier can see when the same tag will be
// read again rather than having to count.
export const SCAN_FLASH_MS = SCAN_DEDUPE_MS;

// The viewfinder's own flash after a read — much shorter, since it only has
// to register as "that one went in" before the next tag is under the lens.
export const SCAN_PULSE_MS = 450;

/* ---------------------------------------------------------------------------
 * The counter: a laptop with a plug-in barcode scanner
 *
 * The phone stays the primary till (CLAUDE.md "Frontend UX"), but the shop
 * counter has a laptop and a hardware scanner on it. Nothing below changes
 * anything the phone does — it is all keyboard, and a phone has none.
 * ------------------------------------------------------------------------ */

// A hardware scanner is a keyboard as far as the browser is concerned: it
// types the code and presses Enter. Nothing needs to be focused for those
// keys to arrive, which is the whole point — the cashier pulls the trigger
// with both hands full and no on-screen keyboard ever opens.
//
// Which keys it pressed is read off `event.code`, never off `event.key` —
// see constants/keyboard.ts, and the shop's Arabic keyboard layout, which
// otherwise turns every scan into Arabic letters.
//
// The one thing that has to be got right is telling the machine apart from a
// person, and the giveaway is speed: a scanner puts its characters out a few
// milliseconds apart, where even a quick typist is nearer a tenth of a
// second. A gap longer than this ends the burst and starts a new one, so a
// person cannot accidentally assemble a "scan" by typing.
export const HARDWARE_SCAN_MAX_KEY_GAP_MS = 40;

// Shortest run of characters that may be taken for a code. The barcodes this
// store prints are EAN-13 and the SKUs are longer still (ORG-12-3), so this
// only has to sit above the length a stray keypress or two could reach.
export const HARDWARE_SCAN_MIN_LENGTH = 4;

// What a scanner sends after the code. Enter is the factory default on
// essentially every model; Tab is the other one in the wild, and a scanner
// already configured that way should not have to be re-programmed to work
// here. NumpadEnter is the same Enter, pressed by a scanner set up to send
// the code over the numeric keypad.
//
// Key CODES, like every other key this screen reads: these three happen to
// be layout-independent either way, but mixing the two ways of naming a key
// in one listener is how the next person introduces the bug this file's
// header is about.
export const HARDWARE_SCAN_TERMINATOR_CODES: readonly string[] = ["Enter", "NumpadEnter", "Tab"];

// The keys the counter keyboard drives a sale with.
//
// Deliberately not plain letters: a letter is also the first character of a
// code, and the scanner is listening for those. "/" is safe because it is
// only ever acted on when nothing is focused, and the function keys and
// Escape are not characters at all.
export const SELL_SHORTCUT_FOCUS_SEARCH = "/";
export const SELL_SHORTCUT_SCAN = "F2";
export const SELL_SHORTCUT_CHECKOUT = "F9";
export const SELL_SHORTCUT_CLEAR = "Escape";

// "/" is the only one of the four that is a character, so it is the only one
// the keyboard layout can take away: on an Arabic layout that key types `ظ`
// and `event.key` never says "/" at all. The key is matched by its place on
// the keyboard as well, which is the key the cap above is printed on
// whatever the layout — the other three are not characters and are already
// the same everywhere.
export const SELL_SHORTCUT_FOCUS_SEARCH_CODE = "Slash";

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
