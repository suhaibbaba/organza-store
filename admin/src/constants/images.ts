// Early client checks mirroring the backend's defaults; the backend's configured limits are the real gate.
export const CLIENT_MAX_IMAGE_SIZE_MB = 10;
export const CLIENT_ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const IMAGE_GRID_THUMB_SIZES = "(min-width: 768px) 120px, 30vw";

// Photo editor drawing only; the stored 2:3 and zoom range are shared with the backend.

// Preview tiles only: the stored photo is cut by sharp, and a huge canvas can crash a phone.
export const CROP_PREVIEW_MAX_PX = 600;

// What the cropper draws, not what is stored: iOS silently refuses huge images; crops are fractions, so this is safe.
export const EDITOR_SOURCE_MAX_PX = 1600;

// Re-framing fetches the original through next/image's optimizer at this width; must be one of its deviceSizes.
export const EDITOR_SOURCE_WIDTH = 1200;

// Next's default qualities is [75]; any other value is refused.
export const NEXT_IMAGE_OPTIMIZER_PATH = "/_next/image";
export const NEXT_IMAGE_QUALITY = 75;

export const CROP_ZOOM_KEY_STEP = 0.05;

// The product page's big photo: half the page on desktop, the full width on a phone.
export const PRODUCT_DETAIL_IMAGE_SIZES = "(max-width: 1023px) 92vw, 28rem";

// Its thumbnail grid: five small squares under the big photo.
export const PRODUCT_DETAIL_THUMB_SIZES = "96px";

// Served from public/ by one URL, so it is cached once and works offline; never the browser's broken-image glyph.
export const PRODUCT_PLACEHOLDER_PATH = "/product-placeholder.svg";

// One map of galleries (product plus one per variant), so the form's single Save walks them all alike.
export const PRODUCT_GALLERY_KEY = "product";
export const VARIANT_GALLERY_PREFIX = "variant:";
export const variantGalleryKey = (variantId: string): string => `${VARIANT_GALLERY_PREFIX}${variantId}`;
export const variantIdFromGalleryKey = (key: string): string | null =>
  key.startsWith(VARIANT_GALLERY_PREFIX) ? key.slice(VARIANT_GALLERY_PREFIX.length) : null;
