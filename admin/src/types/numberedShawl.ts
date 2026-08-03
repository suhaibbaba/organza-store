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
  // note").
  x: number;
  y: number;
  stock: string;
  priceOverride: string;
  variantId: string | null;
  valueId: string | null;
}
