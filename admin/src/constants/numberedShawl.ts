// Numbered shawls (spec.md "Numbered shawls (variant-based)") — admin
// placement UI tuning.

// Pointer movement under this many pixels, on release, still counts as a
// tap (add/select) rather than a drag.
export const POINT_DRAG_THRESHOLD_PX = 6;

export const NUMBERED_SHAWL_IMAGE_SIZES = "(min-width: 768px) 640px, 100vw";

// New points start at the same stock CLAUDE.md rule 7 default as any other
// product/variant row.
export const DEFAULT_POINT_STOCK = "1";
