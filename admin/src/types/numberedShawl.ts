// A placed (or about-to-be-placed) point on a numbered shawl's image — the
// admin UI's working shape before Save creates/updates the underlying
// Number variants (spec.md "Numbered shawls"). Nothing here is linked to a
// real variant/option value until Save.
export interface ShawlPoint {
  // Stable across renders: the persisted variant id once saved, otherwise a
  // local id good only for this editing session.
  id: string;
  // The number shown on the image and read back over WhatsApp — also the
  // key of its global "Number" option value.
  number: number;
  // Percentage of the image's rendered width/height (never pixels, so
  // points stay correct at any screen size — spec.md "Critical technical
  // note"). Null for a number that exists but has never been put on the
  // photo — it still has a quantity and a price of its own to edit.
  x: number | null;
  y: number | null;
  stock: string;
  priceOverride: string;
  variantId: string | null;
  valueId: string | null;
}

// A point that is actually on the photo — the only kind the canvas draws.
export type PlacedShawlPoint = ShawlPoint & { x: number; y: number };
