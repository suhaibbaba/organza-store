// Mirrors backend/src/constants/images.ts's DEFAULT_* fallbacks — used only
// for fast, friendly client-side pre-checks before an upload even starts.
// The backend's actual configured UPLOAD_MAX_SIZE_MB/ALLOWED_IMAGE_TYPES env
// values are the real gate; a mismatch here just means an occasional upload
// skips this early check and gets the same friendly message back from the
// server instead (see error.image.* in ERROR_MESSAGE_KEYS).
export const CLIENT_MAX_IMAGE_SIZE_MB = 10;
export const CLIENT_ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const IMAGE_GRID_THUMB_SIZES = "(min-width: 768px) 120px, 30vw";

// ---------------------------------------------------------------------------
// The photo editor (components/products/image-editor-sheet.tsx)
// ---------------------------------------------------------------------------
// The catalogue's 2:3 and the zoom range are shared with the backend
// (@organza/shared/constants/image) — they decide what is actually stored.
// What lives here is only how the editor is drawn.

/**
 * The longest side of the preview tile drawn after an edit, in pixels.
 *
 * A preview is a thumbnail in a grid three across on a phone, and the stored
 * photograph is cut by sharp on the server regardless — so there is nothing
 * to gain from a canvas the size of a 12-megapixel original, and a phone that
 * runs out of memory building one loses the whole form.
 */
export const CROP_PREVIEW_MAX_PX = 600;

/**
 * The longest side of the picture the EDITOR is given to draw, in pixels.
 *
 * Not the picture that gets stored — that is cut by sharp from the full
 * original and never touches a browser. This is only what the cropper puts on
 * screen, and a phone camera's 12-megapixel photograph is a poor thing to
 * hand it: iOS keeps a budget for decoded images and is entitled to refuse
 * one, which it does silently — the editor comes up black with a broken-image
 * glyph in the middle of it, on the one screen where there is nothing else to
 * look at.
 *
 * A crop is stored as FRACTIONS of the frame (shared's ImageCrop), so cutting
 * it on a scaled-down picture is exactly the same crop. 1600 is the largest
 * size we store, which is far more than any phone screen shows.
 */
export const EDITOR_SOURCE_MAX_PX = 1600;

/**
 * The width a STORED photograph is fetched at when it is re-framed.
 *
 * Re-framing used to load the untouched original straight off the API — a
 * phone camera's 4–5 MB, 12-megapixel JPEG — and shrink it on a canvas in the
 * browser, on the main thread, then load and decode it a second time to draw
 * the preview on Save. A modern phone hides that; the shop's iPhone 7 froze on
 * it. The original is now asked of next/image's optimizer instead, which cuts
 * it to this width with sharp on the server (orientation applied, whole frame
 * kept — never the 2:3 crop) and sends a WebP of a few hundred KB.
 *
 * It must be one of next/image's widths (its default `deviceSizes`), or the
 * optimizer refuses the request; the editor then falls back to the original.
 * 1200 keeps a portrait photo's long side at exactly EDITOR_SOURCE_MAX_PX, so
 * the canvas step in lib/image-edit.ts has nothing left to do.
 */
export const EDITOR_SOURCE_WIDTH = 1200;

// next/image's optimizer, and the quality it is configured to serve (Next's
// default `qualities` is [75]; any other value is refused). Only needed where
// a URL is built by hand rather than by <Image> — the editor above.
export const NEXT_IMAGE_OPTIMIZER_PATH = "/_next/image";
export const NEXT_IMAGE_QUALITY = 75;

/**
 * How far the zoom slider moves per press of an arrow key, as a fraction of
 * its range. A slider a mouse can nudge is the counter screen's answer to a
 * pinch, which it has no way of making.
 */
export const CROP_ZOOM_KEY_STEP = 0.05;

// The one big photo on the product detail page. It is capped by HEIGHT
// (16rem, 18rem from md up), so a photo framed 2:3 — the editor's default,
// and nearly every photo in the shop — is drawn about 171px wide, 192px from
// md up. It used to say "92vw", which on a phone asked for a 750px-wide copy
// (over 200 KB) to fill a box 192px wide; a `vw` in `sizes` also makes
// next/image drop every candidate under 640px from the srcset. In pixels it
// fetches 384px at 2x — a landscape photo, drawn wider, is the one that comes
// out a little soft, and that is the trade.
export const PRODUCT_DETAIL_IMAGE_SIZES = "192px";

// Its thumbnail strip — small fixed squares at every screen size.
export const PRODUCT_DETAIL_THUMB_SIZES = "56px";

/**
 * Drawn wherever a product has no photo, or the photo it has won't load
 * (public/product-placeholder.svg).
 *
 * One flat file at one URL, served straight out of public/ rather than
 * through the image optimizer: the browser and the service worker both cache
 * it by URL, so a list of a hundred photoless products fetches it once. It is
 * also what the app falls back to instead of ever showing the browser's own
 * broken-image glyph.
 */
export const PRODUCT_PLACEHOLDER_PATH = "/product-placeholder.svg";

// Keys for the galleries the product form holds while it is being edited:
// the product's own, plus one per variant. They live in a single map so the
// form's one Save can walk every gallery the same way.
export const PRODUCT_GALLERY_KEY = "product";
export const VARIANT_GALLERY_PREFIX = "variant:";
export const variantGalleryKey = (variantId: string): string => `${VARIANT_GALLERY_PREFIX}${variantId}`;
export const variantIdFromGalleryKey = (key: string): string | null =>
  key.startsWith(VARIANT_GALLERY_PREFIX) ? key.slice(VARIANT_GALLERY_PREFIX.length) : null;
