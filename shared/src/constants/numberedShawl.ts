// Numbered shawls (spec.md "Numbered shawls") — how the numbers drawn on the
// product photo are SIZED and COLOURED.
//
// Both live here rather than in one app's CSS because the same numbers are
// drawn in more than one place: the admin's placement canvas, the product
// detail page, and (once it is built) the WhatsApp export that burns them
// into a copy of the photo with `sharp`. A shared marker has to look the
// same in all of them, or the shop and the customer are looking at two
// different pictures.

// ---------------------------------------------------------------------------
// Geometry — proportions of the RENDERED image, never pixels
// ---------------------------------------------------------------------------
// A marker fixed at 32px is a third of a thumbnail and a speck on a desktop
// photo, which is what made the numbers pile on top of each other on a small
// rendering. Everything below is a share of the displayed image's WIDTH (not
// its height: a marker must not stretch when the photo is portrait), so the
// layout looks identical at every size. Each app still clamps the result
// into a tappable/legible range — see the app's own constants file.

/** Marker width, as a percentage of the rendered image's width. */
export const POINT_MARKER_WIDTH_PERCENT = 11;

/**
 * Width ÷ height of a marker. A rounded rectangle rather than a circle:
 * "12" does not fit comfortably inside a circle at a size anybody would
 * want to tap.
 */
export const POINT_MARKER_ASPECT_RATIO = 1.6;

/** Corner radius, as a percentage of the marker's own height. */
export const POINT_MARKER_RADIUS_PERCENT = 34;

/** Number text size, as a percentage of the rendered image's width. */
export const POINT_MARKER_FONT_PERCENT = 5;

/** Border thickness, as a percentage of the rendered image's width. */
export const POINT_MARKER_BORDER_PERCENT = 0.45;

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------
// The shop chooses per product (Product.pointTextColor / pointBackgroundColor).
// Null means "whatever suits this photo" — the suggestion below, recomputed
// from the image. A chosen colour is stored and survives a replaced photo.

export interface PointColors {
  text: string;
  background: string;
}

/** Light marker: for a dark photograph (a black abaya). */
export const POINT_COLORS_FOR_DARK_IMAGE: PointColors = {
  text: "#111827",
  background: "#FFFFFF",
};

/** Dark marker: for a pale photograph (a cream scarf). */
export const POINT_COLORS_FOR_LIGHT_IMAGE: PointColors = {
  text: "#FFFFFF",
  background: "#111827",
};

/**
 * Perceived brightness (0–100, see lib/pointColors.ts) at or above which a
 * photo counts as "light" and earns dark markers. Above the middle of the
 * range on purpose: a photo has to be genuinely pale before white numbers
 * are the wrong answer, and white-on-dark is the safer default of the two.
 */
export const IMAGE_BRIGHTNESS_LIGHT_THRESHOLD = 58;

/** The lowest and highest a stored brightness reading can be. */
export const IMAGE_BRIGHTNESS_MIN = 0;
export const IMAGE_BRIGHTNESS_MAX = 100;

/**
 * The pair used when there is nothing to sample — no photo, or one uploaded
 * before brightness was recorded. Deliberately the marker this feature
 * shipped with, so an existing product looks exactly as it did until
 * somebody chooses otherwise.
 */
export const POINT_COLORS_FALLBACK: PointColors = POINT_COLORS_FOR_LIGHT_IMAGE;

/**
 * The WCAG AA ratio for large text. A marker whose two chosen colours fall
 * below it has its TEXT swapped for black or white at render time — the
 * numbers are the whole point of the picture, so they are never allowed to
 * disappear into their own badge.
 */
export const MIN_POINT_CONTRAST_RATIO = 3;

/** What the text falls back to when the chosen pair is illegible. */
export const POINT_TEXT_CONTRAST_FALLBACKS = ["#FFFFFF", "#111827"] as const;

/** `#RGB` or `#RRGGBB`, the two forms a colour input produces. */
export const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
