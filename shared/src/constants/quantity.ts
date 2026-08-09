// How big a quantity a person may type into any counting field — a cart
// line, a return, a stock correction, a run of barcode labels. One pair of
// numbers for admin and POS both, so the same box never accepts 1200 on one
// screen and refuses it on the next.
//
// Zero is the floor because "none" is a real answer: a return line nobody is
// returning, a piece that needs no label. Screens whose own floor is higher
// (a cart line is at least one piece) keep it — they narrow this range, they
// never widen it.
//
// 999 is a ceiling on the FIELD, not on the shop: a garment shop counts in
// tens, and an extra digit slipped in on a phone keyboard is far likelier
// than a genuine four-figure count. Where a real stock number is above it,
// the screen says so out loud rather than quietly handing back a smaller
// number than was asked for (see the labels screen).
export const QUANTITY_MIN = 0;
export const QUANTITY_MAX = 999;

// Longest run of digits any quantity box accepts, so a stray keypress cannot
// even begin to build a number past the ceiling.
export const QUANTITY_MAX_LENGTH = String(QUANTITY_MAX).length;

// Clamps a number into the field's range. Used for typed and pasted values
// exactly as it is for the +/- buttons, so there is one answer to "what does
// this box do with 1200" wherever it is asked.
export function clampQuantity(value: number, min: number = QUANTITY_MIN, max: number = QUANTITY_MAX): number {
  const floor = Math.max(min, QUANTITY_MIN);
  const ceiling = Math.min(max, QUANTITY_MAX);
  // A caller whose own ceiling is below the floor (no stock left, say) gets
  // the floor rather than an inverted range.
  if (ceiling < floor) return floor;
  return Math.min(Math.max(value, floor), ceiling);
}
