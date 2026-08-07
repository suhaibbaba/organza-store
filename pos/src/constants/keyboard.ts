/* ---------------------------------------------------------------------------
 * Physical keys, not the letters the operating system thinks they are
 *
 * The counter's barcode scanner is a USB keyboard. It does not send text — it
 * sends key presses, and the operating system turns each one into a character
 * using whichever layout is currently active. In this shop that layout is
 * Arabic, all day, because Arabic is what the staff type.
 *
 * So the scanner presses the key marked `5` and `event.key` says `٥`; it
 * presses `A` and `event.key` says `ش`. Nothing that comes out matches a
 * barcode or a SKU, every scan fails, and the only workaround the cashier has
 * is to switch the keyboard to English before scanning and back to Arabic
 * afterwards — several times a minute.
 *
 * `event.code` is the key itself, in its place on the keyboard, and never
 * changes with the layout: the `5` key is `Digit5` under Arabic, English and
 * Hebrew alike. Scanners emulate a US keyboard, so the characters can simply
 * be worked out from the code — which is what the table below is for.
 * ------------------------------------------------------------------------ */

// Every key a barcode can be made of, as [unshifted, shifted].
//
// That is the whole printable US layout rather than only the digits, because
// the codes in this shop are not all digits: EAN-13 barcodes are (CLAUDE.md
// rule 13), but SKUs are `ORG-12-3` (CLAUDE.md rule 1), and a scanner reading
// one sends letters, a hyphen, and Shift for each capital. Code 39 — what
// most label printers fall back to — adds space, `.`, `$`, `/`, `+` and `%`
// on top of that. Listing the rest costs nothing and means a code with a
// character nobody anticipated still scans instead of silently truncating.
export const PHYSICAL_KEY_CHARS: Readonly<Record<string, readonly [string, string]>> = {
  Digit1: ["1", "!"],
  Digit2: ["2", "@"],
  Digit3: ["3", "#"],
  Digit4: ["4", "$"],
  Digit5: ["5", "%"],
  Digit6: ["6", "^"],
  Digit7: ["7", "&"],
  Digit8: ["8", "*"],
  Digit9: ["9", "("],
  Digit0: ["0", ")"],

  KeyA: ["a", "A"],
  KeyB: ["b", "B"],
  KeyC: ["c", "C"],
  KeyD: ["d", "D"],
  KeyE: ["e", "E"],
  KeyF: ["f", "F"],
  KeyG: ["g", "G"],
  KeyH: ["h", "H"],
  KeyI: ["i", "I"],
  KeyJ: ["j", "J"],
  KeyK: ["k", "K"],
  KeyL: ["l", "L"],
  KeyM: ["m", "M"],
  KeyN: ["n", "N"],
  KeyO: ["o", "O"],
  KeyP: ["p", "P"],
  KeyQ: ["q", "Q"],
  KeyR: ["r", "R"],
  KeyS: ["s", "S"],
  KeyT: ["t", "T"],
  KeyU: ["u", "U"],
  KeyV: ["v", "V"],
  KeyW: ["w", "W"],
  KeyX: ["x", "X"],
  KeyY: ["y", "Y"],
  KeyZ: ["z", "Z"],

  Minus: ["-", "_"],
  Equal: ["=", "+"],
  BracketLeft: ["[", "{"],
  BracketRight: ["]", "}"],
  Backslash: ["\\", "|"],
  Semicolon: [";", ":"],
  Quote: ["'", '"'],
  Backquote: ["`", "~"],
  Comma: [",", "<"],
  Period: [".", ">"],
  Slash: ["/", "?"],
  Space: [" ", " "],

  // Some scanners are configured to send the code over the numeric keypad.
  // Shift does not change what these produce, so both halves are the same.
  Numpad0: ["0", "0"],
  Numpad1: ["1", "1"],
  Numpad2: ["2", "2"],
  Numpad3: ["3", "3"],
  Numpad4: ["4", "4"],
  Numpad5: ["5", "5"],
  Numpad6: ["6", "6"],
  Numpad7: ["7", "7"],
  Numpad8: ["8", "8"],
  Numpad9: ["9", "9"],
  NumpadDecimal: [".", "."],
  NumpadSubtract: ["-", "-"],
  NumpadAdd: ["+", "+"],
  NumpadDivide: ["/", "/"],
  NumpadMultiply: ["*", "*"],
};

// Codes whose character is a letter, and so the only ones Caps Lock has any
// say over. Caps Lock has never turned a `5` into a `%`.
export const LETTER_KEY_CODE_PATTERN = /^Key[A-Z]$/;

// Held down while another key is pressed, and pressed on their own account
// first. A scanner sending an upper-case letter presses Shift before the
// letter, so these must not be mistaken for "the burst ended" — they are not
// characters, and they are not the absence of one either.
export const MODIFIER_KEY_CODES: readonly string[] = [
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "CapsLock",
  "NumLock",
  "ScrollLock",
];

/* ---------------------------------------------------------------------------
 * Arabic-Indic digits
 *
 * The other half of the same problem, on the other path in: a cashier reading
 * a damaged label out by hand types it into the search box with the Arabic
 * keyboard they already have, and on most Arabic layouts the digit row sends
 * `٤` rather than `4`. Nothing in the catalogue is stored that way — barcodes
 * and SKUs are ASCII — so the lookup would answer "no such product" for a
 * code the cashier typed perfectly correctly.
 * ------------------------------------------------------------------------ */

// Arabic-Indic (٠-٩, used across the Levant) and Extended Arabic-Indic
// (۰-۹, Persian/Urdu), in value order, so index IS the digit.
export const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const EXTENDED_ARABIC_INDIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
