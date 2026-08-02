// Mirrors backend/src/constants/images.ts's DEFAULT_* fallbacks — used only
// for fast, friendly client-side pre-checks before an upload even starts.
// The backend's actual configured UPLOAD_MAX_SIZE_MB/ALLOWED_IMAGE_TYPES env
// values are the real gate; a mismatch here just means an occasional upload
// skips this early check and gets the same friendly message back from the
// server instead (see error.image.* in ERROR_MESSAGE_KEYS).
export const CLIENT_MAX_IMAGE_SIZE_MB = 10;
export const CLIENT_ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const IMAGE_GRID_THUMB_SIZES = "(min-width: 768px) 120px, 30vw";
