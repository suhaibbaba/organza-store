import {
  ARABIC_INDIC_DIGITS,
  EXTENDED_ARABIC_INDIC_DIGITS,
  LETTER_KEY_CODE_PATTERN,
  MODIFIER_KEY_CODES,
  PHYSICAL_KEY_CHARS,
} from "@/constants/keyboard";

// See constants/keyboard.ts for why any of this exists: the shop's keyboard
// layout is Arabic, and a wedge scanner's key presses come out of it as
// Arabic letters and Arabic-Indic digits unless they are read off the key's
// physical position instead.

// The parts of a keydown event this module reads, as a structural type rather
// than the DOM's `KeyboardEvent`: `shared` is compiled for the backend too,
// which has no DOM lib. A real KeyboardEvent satisfies it as-is.
export interface PhysicalKeyEvent {
  code: string;
  key: string;
  shiftKey: boolean;
  getModifierState(key: string): boolean;
}

// What a key press was meant to type, worked out from the key's place on the
// keyboard rather than from what the current layout made of it — see the
// header of constants/keyboard.ts for why that distinction is the difference
// between the scanner working and not.
//
// Returns null for anything that is not a character: arrows, Escape, function
// keys, Enter, and the modifiers themselves.
export function physicalKeyChar(event: PhysicalKeyEvent): string | null {
  const pair = PHYSICAL_KEY_CHARS[event.code];

  if (!pair) {
    // A key this table doesn't name. Almost always a genuine non-character
    // (Escape, F5, ArrowLeft), but it is also what a device that reports no
    // `code` at all looks like — an on-screen keyboard, or a scanner in a
    // mode that sends synthesised events. Falling back to `event.key` there
    // is exactly the old behaviour, which is right for everything except the
    // case this whole module exists for.
    return event.key.length === 1 ? event.key : null;
  }

  const [plain, shifted] = pair;
  // Caps Lock only has a say over letters, and Shift cancels it out the way
  // it does on any keyboard.
  const upper = LETTER_KEY_CODE_PATTERN.test(event.code)
    ? event.shiftKey !== event.getModifierState("CapsLock")
    : event.shiftKey;

  return upper ? shifted : plain;
}

// Shift, Caps Lock and friends, pressed on their own account. Not a
// character, but not the end of one either.
export function isModifierKey(event: Pick<PhysicalKeyEvent, "code">): boolean {
  return MODIFIER_KEY_CODES.includes(event.code);
}

// `٤٠١٢` typed on an Arabic keyboard is the number 4012, and the catalogue
// stores every barcode and SKU in plain ASCII. Only the digits are touched:
// the rest of a typed code is left exactly as entered, because a SKU is
// looked up as text and rewriting letters would be guessing.
export function toLatinDigits(value: string): string {
  let out = "";
  for (const char of value) {
    const arabicIndic = ARABIC_INDIC_DIGITS.indexOf(char);
    if (arabicIndic >= 0) {
      out += String(arabicIndic);
      continue;
    }
    const extended = EXTENDED_ARABIC_INDIC_DIGITS.indexOf(char);
    out += extended >= 0 ? String(extended) : char;
  }
  return out;
}
