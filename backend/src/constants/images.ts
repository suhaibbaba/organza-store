// Stored locally, optimized with sharp into WebP sizes: thumbnail (lists), medium (POS), full (product page).
export const DEFAULT_UPLOAD_DIR = "./uploads";
export const DEFAULT_UPLOAD_MAX_SIZE_MB = 10;
export const DEFAULT_ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const IMAGE_SIZES = {
  thumbnail: 300,
  medium: 800,
  full: 1600,
} as const;

export const IMAGE_WEBP_QUALITY = 82;

// The shop logo: one WebP, alpha kept, fitted inside this square.
export const LOGO_MAX_DIMENSION = 512;
export const LOGO_FILE_PREFIX = "logo";

export { FAVICON_SIZES } from "@organza/shared/constants/brand";
export const FAVICON_FILE_PREFIX = "favicon";
// iOS paints a transparent home-screen icon black, so its size is flattened onto white.
export const FAVICON_OPAQUE_SIZE = 180;
export const FAVICON_OPAQUE_BACKGROUND = "#ffffff";
export const FAVICON_CLEAR_BACKGROUND = { r: 0, g: 0, b: 0, alpha: 0 };

// The original is kept byte-for-byte as <uuid>-original.<ext> so a garment can be re-cropped later.
export const IMAGE_ORIGINAL_SUFFIX = "original";

// A format missing here still uploads; it just keeps no original and cannot be re-cropped.
export const IMAGE_ORIGINAL_EXTENSIONS: Record<string, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

// EXIF orientations stored on their side: the crop is resolved against the turned width and height.
export const EXIF_ORIENTATIONS_SWAPPING_AXES = [5, 6, 7, 8];

// Ties an original back to its stored image during an uploads sweep (lib/uploads.ts).
export const IMAGE_ORIGINAL_FILE_PATTERN = /-original\.[A-Za-z0-9]+$/;

// Rec. 709 luma weights, used to suggest a numbered shawl's number colour (spec.md "Numbered shawls").
export const BRIGHTNESS_WEIGHTS = { r: 0.2126, g: 0.7152, b: 0.0722 } as const;

// The one photo a row shows: the primary, else the first by order (spec.md: lowest sortOrder = primary).
export const MAIN_IMAGE_ONLY = {
  orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
  take: 1,
  select: { thumbnailUrl: true },
};

// Burned-in numbers (lib/markedImage.ts): a marker's width as a share of each size, larger on the thumbnail so it reads at 64px.
export const MARKED_IMAGE_MARKER_WIDTH_PERCENT = { thumbnail: 16, medium: 12, full: 11 } as const;
export const MARKED_IMAGE_FILE_INFIX = "-marked-";
export const MARKED_IMAGE_SOLD_OUT_OPACITY = 0.45;
export const MARKED_IMAGE_FONT_FAMILY = "DejaVu Sans, Arial, Helvetica, sans-serif";
export const MARKED_IMAGE_QUEUE_MS = 1500;
// Bump when the drawing itself changes, so images:mark redraws every numbered photo on the next deploy.
export const MARKED_IMAGE_LAYOUT_VERSION = 2;
// images:mark leaves a burned-in file younger than this alone: the server may be about to save its row.
export const MARKED_IMAGE_SWEEP_GRACE_MS = 10 * 60 * 1000;
