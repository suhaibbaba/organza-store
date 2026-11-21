// One quantity range for every counting field in both apps; 999 caps the field, not the shop, and screens may only narrow it.
export const QUANTITY_MIN = 0;
export const QUANTITY_MAX = 999;

// Longest digit run a quantity box accepts.
export const QUANTITY_MAX_LENGTH = String(QUANTITY_MAX).length;

// Clamps typed, pasted and +/- values alike.
export function clampQuantity(value: number, min: number = QUANTITY_MIN, max: number = QUANTITY_MAX): number {
  const floor = Math.max(min, QUANTITY_MIN);
  const ceiling = Math.min(max, QUANTITY_MAX);
  // A ceiling below the floor (no stock) gives the floor.
  if (ceiling < floor) {
    return floor;
  }
  return Math.min(Math.max(value, floor), ceiling);
}

// A new product or variant starts with one piece in stock (CLAUDE.md rule 7).
export const DEFAULT_STOCK = 1;
