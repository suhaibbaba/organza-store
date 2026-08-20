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

// ---------------------------------------------------------------------------
// The original, kept
// ---------------------------------------------------------------------------
// A photograph is stored a fourth time, exactly as it was uploaded, beside
// the three sizes cut from it: `<uuid>-original.<ext>`. It is what makes a
// crop reconsiderable — the shop frames a garment in the admin's editor
// (spec.md "Editing a photograph on upload"), and a different framing months
// later has to come from the whole picture, not from a picture already cut
// down to 2:3 and re-compressed.
//
// The bytes are written through untouched. Re-encoding "the original" would
// make it a copy of the original, which is the one thing it must not be.
export const IMAGE_ORIGINAL_SUFFIX = "original";

// The extension each format sharp can report is stored under, so the file
// keeps a name a browser and an editor can both read. A format not in this
// list simply gets no original kept: the upload still works and the photo is
// still stored, it just cannot be re-cropped later. Every type the API
// accepts (DEFAULT_ALLOWED_IMAGE_TYPES) is here.
export const IMAGE_ORIGINAL_EXTENSIONS: Record<string, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

// EXIF orientations that mean "this photograph is stored on its side": the
// file's own width and height are the other way round from the picture
// everybody looks at. A phone held sideways records one of these rather than
// turning the pixels, and every browser turns it back when it draws the
// image — so the editor's frame is the turned one, and the crop it sends has
// to be resolved against the turned dimensions. sharp's autoOrient() does
// the turning; this list is how the geometry knows the size to expect.
export const EXIF_ORIENTATIONS_SWAPPING_AXES = [5, 6, 7, 8];

// Matches the tail of an original's file name, so a sweep of the uploads
// folder can tell which stored image `<uuid>-original.jpg` belongs to (see
// lib/uploads.ts). Anchored, and deliberately narrow: only what this app
// writes.
export const IMAGE_ORIGINAL_FILE_PATTERN = /-original\.[A-Za-z0-9]+$/;

// Rec. 709 luma weights — what the eye reads as brightness, which is mostly
// the green channel. Used to measure an uploaded photograph so a numbered
// shawl's numbers can suggest their own colour (spec.md "Numbered shawls").
export const BRIGHTNESS_WEIGHTS = { r: 0.2126, g: 0.7152, b: 0.0722 } as const;
