// The catalogue's picture, as a shape rather than as a file (spec.md
// "Product images" / CLAUDE.md: images are optimized with sharp on upload and
// drawn with next/image).
//
// These live in shared because THREE places have to agree about them: the
// admin's editor, which draws the crop box; the backend, which cuts the photo
// to it; and any screen that reserves room for the result. A ratio written
// twice is a ratio that will disagree once.

/**
 * The shape a garment is framed in — 2 wide by 3 tall.
 *
 * Portrait, because a dress on a hanger is portrait: a square crop takes the
 * hem or the shoulders off almost every piece in the shop. Held as two whole
 * numbers so the label ("2:3") and the number (0.666…) come from one place.
 */
export const PRODUCT_IMAGE_ASPECT = { width: 2, height: 3 } as const;

/** Width ÷ height — what react-easy-crop and CSS `aspect-ratio` both want. */
export const PRODUCT_IMAGE_ASPECT_RATIO = PRODUCT_IMAGE_ASPECT.width / PRODUCT_IMAGE_ASPECT.height;

/**
 * A photo may be turned only in quarter turns, clockwise.
 *
 * Free rotation would mean either blank corners or a second, invisible crop,
 * and neither is something to ask of somebody photographing stock on a
 * counter. A phone that recorded its orientation wrongly is what this is for,
 * and that is always a quarter turn.
 */
export const IMAGE_ROTATION_STEP = 90;
export const IMAGE_ROTATIONS = [0, 90, 180, 270] as const;
export type ImageRotation = (typeof IMAGE_ROTATIONS)[number];

/**
 * How far into the photo the editor may zoom. 1 is the whole frame; 4 is a
 * quarter of it in each direction, which on a 1600px-wide photo still leaves
 * more pixels than the largest size we store — so zooming in can never
 * produce a soft picture.
 */
export const IMAGE_ZOOM = { min: 1, max: 4, step: 0.01 } as const;

/**
 * The smallest crop the backend will cut, in pixels of the original.
 *
 * A crop rectangle arrives as fractions, so a rounding error on a very small
 * photo could ask sharp for a zero-width region — which throws. One pixel is
 * the floor; nothing real ever comes near it.
 */
export const IMAGE_CROP_MIN_PIXELS = 1;
