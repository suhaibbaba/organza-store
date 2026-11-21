// Marker proportions are shared (the WhatsApp copy must match); only these pixel bounds are the admin's.

export const POINT_DRAG_THRESHOLD_PX = 6;

export const NUMBERED_SHAWL_IMAGE_SIZES = "(min-width: 768px) 640px, 100vw";

// Rule 7: stock defaults to 1.
export const DEFAULT_POINT_STOCK = "1";

// Height is capped too and the width derived from it, keeping the aspect ratio the points' percentages depend on.

/** Placing the points: as large as fits, since they are placed by finger. */
export const POINT_CANVAS_MAX_HEIGHT = "min(55vh, 34rem)";

/** Reading them (the detail page): the photo shares the screen with the rest. */
export const POINT_PREVIEW_MAX_HEIGHT = "min(38vh, 26rem)";

// A low minimum keeps markers from crowding; touch size comes from POINT_MARKER_TOUCH_PADDING_PX instead.
export const POINT_MARKER_MIN_WIDTH_PX = 32;
export const POINT_MARKER_MAX_WIDTH_PX = 64;
export const POINT_MARKER_MIN_FONT_PX = 12;
export const POINT_MARKER_MAX_FONT_PX = 18;
export const POINT_MARKER_MIN_BORDER_PX = 1.5;
export const POINT_MARKER_MAX_BORDER_PX = 3;

// Makes even the smallest marker a 60×45 touch target without a 44px badge on the photo.
export const POINT_MARKER_TOUCH_PADDING_PX = 14;
