// Mirrors backend/src/constants/images.ts's DEFAULT_* fallbacks — used only
// for fast, friendly client-side pre-checks before an upload even starts.
// The backend's actual configured UPLOAD_MAX_SIZE_MB/ALLOWED_IMAGE_TYPES env
// values are the real gate; a mismatch here just means an occasional upload
// skips this early check and gets the same friendly message back from the
// server instead (see error.image.* in ERROR_MESSAGE_KEYS).
export const CLIENT_MAX_IMAGE_SIZE_MB = 10;
export const CLIENT_ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const IMAGE_GRID_THUMB_SIZES = "(min-width: 768px) 120px, 30vw";

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
