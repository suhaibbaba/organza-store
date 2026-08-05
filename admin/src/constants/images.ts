// Mirrors backend/src/constants/images.ts's DEFAULT_* fallbacks — used only
// for fast, friendly client-side pre-checks before an upload even starts.
// The backend's actual configured UPLOAD_MAX_SIZE_MB/ALLOWED_IMAGE_TYPES env
// values are the real gate; a mismatch here just means an occasional upload
// skips this early check and gets the same friendly message back from the
// server instead (see error.image.* in ERROR_MESSAGE_KEYS).
export const CLIENT_MAX_IMAGE_SIZE_MB = 10;
export const CLIENT_ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const IMAGE_GRID_THUMB_SIZES = "(min-width: 768px) 120px, 30vw";

// Keys for the galleries the product form holds while it is being edited:
// the product's own, plus one per variant. They live in a single map so the
// form's one Save can walk every gallery the same way.
export const PRODUCT_GALLERY_KEY = "product";
export const VARIANT_GALLERY_PREFIX = "variant:";
export const variantGalleryKey = (variantId: string): string => `${VARIANT_GALLERY_PREFIX}${variantId}`;
export const variantIdFromGalleryKey = (key: string): string | null =>
  key.startsWith(VARIANT_GALLERY_PREFIX) ? key.slice(VARIANT_GALLERY_PREFIX.length) : null;
