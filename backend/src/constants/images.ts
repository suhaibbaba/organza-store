// CLAUDE.md rule: images stored locally on the VPS, optimized with sharp
// (WebP + multi-size) on upload. Sizes: thumbnail (lists), medium (POS), full (product page).
export const DEFAULT_UPLOAD_DIR = "./uploads";
export const DEFAULT_UPLOAD_MAX_SIZE_MB = 10;
export const DEFAULT_ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const IMAGE_SIZES = {
  thumbnail: 300,
  medium: 800,
  full: 1600,
} as const;

export const IMAGE_WEBP_QUALITY = 82;
