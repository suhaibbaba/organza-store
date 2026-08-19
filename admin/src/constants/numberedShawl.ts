// Numbered shawls (spec.md "Numbered shawls (variant-based)") — admin
// placement UI tuning. The proportions the markers are drawn at are shared
// (@organza/shared/constants/numberedShawl), because the WhatsApp copy has to
// match what the shop sees; only the pixel bounds below are this app's.

// Pointer movement under this many pixels, on release, still counts as a
// tap (add/select) rather than a drag.
export const POINT_DRAG_THRESHOLD_PX = 6;

export const NUMBERED_SHAWL_IMAGE_SIZES = "(min-width: 768px) 640px, 100vw";

// New points start at the same stock CLAUDE.md rule 7 default as any other
// product/variant row.
export const DEFAULT_POINT_STOCK = "1";

// ---------------------------------------------------------------------------
// How big the photo may get
// ---------------------------------------------------------------------------
// A cap on the HEIGHT as well as the width, because a portrait photo given
// the full width of a desktop column stands taller than the window and pushes
// everything else below the fold. The box keeps the photo's own aspect ratio
// either way — the points are percentages of it, so it is the one thing that
// must not change — and the width is derived from the cap
// (`min(100%, ratio × max-height)`), which is what keeps the numbers on the
// photo instead of beside it.
//
// vh as well as rem so the cap follows a short window (a phone in landscape)
// rather than only a small one.

/** Placing the points: as large as fits, since they are placed by finger. */
export const POINT_CANVAS_MAX_HEIGHT = "min(55vh, 34rem)";

/** Reading them (the detail page): the photo shares the screen with the rest. */
export const POINT_PREVIEW_MAX_HEIGHT = "min(38vh, 26rem)";

// ---------------------------------------------------------------------------
// How big one marker gets
// ---------------------------------------------------------------------------
// The proportion itself (a share of the rendered image's width) is shared;
// these are the bounds it is clamped into, so a thumbnail keeps readable
// numbers and a full-screen photo does not grow silly ones. Deliberately a
// LOW minimum: raising it is what makes markers crowd each other on a small
// rendering, which is the bug this replaced. Touchability is handled instead
// by an invisible hit area around the marker (POINT_MARKER_TOUCH_PADDING_PX),
// so a finger gets its 44px without the drawing growing to match.
export const POINT_MARKER_MIN_WIDTH_PX = 32;
export const POINT_MARKER_MAX_WIDTH_PX = 64;
export const POINT_MARKER_MIN_FONT_PX = 12;
export const POINT_MARKER_MAX_FONT_PX = 18;
export const POINT_MARKER_MIN_BORDER_PX = 1.5;
export const POINT_MARKER_MAX_BORDER_PX = 3;

/**
 * Invisible padding around each draggable marker, per side. Measured on the
 * smallest marker (32 × 20 including its border) it makes a 60 × 45 touch
 * target — past the 44px phone minimum — without a 44px badge sitting on a
 * 300px-wide photo.
 */
export const POINT_MARKER_TOUCH_PADDING_PX = 14;
