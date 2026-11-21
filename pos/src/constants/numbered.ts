// Marker proportions are shared with the admin (numberedShawl) so a number looks the same in both apps.

/** The photo's height cap in the picker: room left for the number box and grid. */
export const NUMBERED_PHOTO_MAX_HEIGHT = "min(42vh, 26rem)";

/** next/image hint for that photo — never wider than the picker's 896px cap. */
export const NUMBERED_PHOTO_SIZES = "(min-width: 600px) 560px, 100vw";

/** Until the photo reports its own ratio — most product photos are portrait. */
export const NUMBERED_PHOTO_PLACEHOLDER_RATIO = 4 / 5;

export const NUMBER_MARKER_MIN_WIDTH_PX = 32;
export const NUMBER_MARKER_MAX_WIDTH_PX = 64;
export const NUMBER_MARKER_MIN_FONT_PX = 12;
export const NUMBER_MARKER_MAX_FONT_PX = 18;
export const NUMBER_MARKER_MIN_BORDER_PX = 1.5;
export const NUMBER_MARKER_MAX_BORDER_PX = 3;

/** Invisible padding round each marker, per side: a 32×20 badge becomes a 60×48 target. */
export const NUMBER_MARKER_TOUCH_PADDING_PX = 14;
