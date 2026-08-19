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

// Rec. 709 luma weights — what the eye reads as brightness, which is mostly
// the green channel. Used to measure an uploaded photograph so a numbered
// shawl's numbers can suggest their own colour (spec.md "Numbered shawls").
export const BRIGHTNESS_WEIGHTS = { r: 0.2126, g: 0.7152, b: 0.0722 } as const;
