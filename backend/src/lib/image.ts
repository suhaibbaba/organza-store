import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp, { type Sharp } from "sharp";
import { AppError } from "@/lib/response";
import { ERROR_CODES } from "@/constants";
import { IMAGE_BRIGHTNESS_MAX, IMAGE_BRIGHTNESS_MIN } from "@store/shared/constants/numberedShawl";
import {
  IDENTITY_IMAGE_EDIT,
  resolveImageEditOps,
  type ImageEdit,
  type ImageEditOps,
} from "@store/shared/lib/imageEdit";
import {
  BRIGHTNESS_WEIGHTS,
  DEFAULT_ALLOWED_IMAGE_TYPES,
  DEFAULT_UPLOAD_DIR,
  DEFAULT_UPLOAD_MAX_SIZE_MB,
  EXIF_ORIENTATIONS_SWAPPING_AXES,
  IMAGE_ORIGINAL_EXTENSIONS,
  IMAGE_ORIGINAL_SUFFIX,
  IMAGE_SIZES,
  IMAGE_WEBP_QUALITY,
  LOGO_FILE_PREFIX,
  LOGO_MAX_DIMENSION,
  FAVICON_CLEAR_BACKGROUND,
  FAVICON_FILE_PREFIX,
  FAVICON_OPAQUE_BACKGROUND,
  FAVICON_OPAQUE_SIZE,
  FAVICON_SIZES,
} from "@/constants";
import type { FaviconSize, FaviconUrls, ImageSize, StoredImage } from "@/types";

// Absolute in every deployment: a relative UPLOAD_DIR resolves inside the container layer and is lost on redeploy.
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? DEFAULT_UPLOAD_DIR);
export const UPLOAD_MAX_SIZE_MB = Number(process.env.UPLOAD_MAX_SIZE_MB ?? DEFAULT_UPLOAD_MAX_SIZE_MB);
export const ALLOWED_IMAGE_TYPES = (process.env.ALLOWED_IMAGE_TYPES ?? DEFAULT_ALLOWED_IMAGE_TYPES.join(","))
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

/** Proves UPLOAD_DIR is writable by writing and deleting a file, at startup, since this is a deployment failure. */
export async function checkUploadDirWritable(): Promise<{ ok: true } | { ok: false; error: Error }> {
  const probe = path.join(UPLOAD_DIR, `.write-probe-${crypto.randomUUID()}`);
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(probe, "");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  } finally {
    await fs.unlink(probe).catch(() => undefined);
  }
}

/** Photo lightness 0–100, read once so a numbered shawl's numbers can suggest a contrasting colour. */
export async function measureBrightness(image: Sharp): Promise<number> {
  const { channels } = await image.stats();
  const [r, g, b] = channels;
  if (!r || !g || !b) {
    throw new Error("no channel statistics");
  }
  const luma = (BRIGHTNESS_WEIGHTS.r * r.mean + BRIGHTNESS_WEIGHTS.g * g.mean + BRIGHTNESS_WEIGHTS.b * b.mean) / 255;
  return Math.min(IMAGE_BRIGHTNESS_MAX, Math.max(IMAGE_BRIGHTNESS_MIN, Math.round(luma * IMAGE_BRIGHTNESS_MAX)));
}

/** Displayed size and format in one decode; sharp refusing to decode is what catches a non-image sent as image/png. */
async function readImageMetadata(buffer: Buffer): Promise<{ width: number; height: number; format: string }> {
  const metadata = await sharp(buffer)
    .metadata()
    .catch(() => null);
  if (!metadata?.format || !metadata.width || !metadata.height) {
    throw new AppError(400, ERROR_CODES.IMAGE_INVALID_TYPE);
  }
  const sideways = EXIF_ORIENTATIONS_SWAPPING_AXES.includes(metadata.orientation ?? 1);
  return {
    width: sideways ? metadata.height : metadata.width,
    height: sideways ? metadata.width : metadata.height,
    format: metadata.format,
  };
}

/** One sharp pipeline for the shop's edit; the order (autoOrient, extract, resize, mirror, rotate) is the only one that works. */
function editedPipeline(buffer: Buffer, ops: ImageEditOps, maxDimension: number | null): Sharp {
  let pipeline = sharp(buffer).autoOrient();
  if (ops.extract) {
    pipeline = pipeline.extract(ops.extract);
  }
  if (maxDimension !== null) {
    pipeline = pipeline.resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  if (ops.flop) {
    pipeline = pipeline.flop();
  }
  if (ops.flip) {
    pipeline = pipeline.flip();
  }
  if (ops.rotation) {
    pipeline = pipeline.rotate(ops.rotation);
  }
  return pipeline;
}

// Every size is cut from the original buffer (never from a larger size), WebP, never upscaled.
async function writeSizes(buffer: Buffer, filename: string, ops: ImageEditOps): Promise<Record<ImageSize, string>> {
  const urls = {} as Record<ImageSize, string>;
  for (const [size, maxDimension] of Object.entries(IMAGE_SIZES) as [ImageSize, number][]) {
    const outputName = `${filename}-${size}.webp`;
    await editedPipeline(buffer, ops, maxDimension)
      .webp({ quality: IMAGE_WEBP_QUALITY })
      .toFile(path.join(UPLOAD_DIR, outputName));
    urls[size] = `/uploads/${outputName}`;
  }
  return urls;
}

/** The edited picture as a readable pipeline, exported so tests exercise the exact code that ships. */
export function editedImage(buffer: Buffer, ops: ImageEditOps, maxDimension: number | null = null): Sharp {
  return editedPipeline(buffer, ops, maxDimension);
}

/** The crop at full size, right way up, for statistics; turn and mirror skipped since they change nothing measured. */
function unturned(buffer: Buffer, ops: ImageEditOps): Sharp {
  return editedPipeline(buffer, { ...ops, flop: false, flip: false, rotation: 0 }, null);
}

/** Keeps the uploaded bytes untouched beside the sizes, so a later re-crop starts from full quality; null for unknown formats. */
async function writeOriginal(buffer: Buffer, filename: string, format: string): Promise<string | null> {
  const extension = IMAGE_ORIGINAL_EXTENSIONS[format];
  if (!extension) {
    return null;
  }
  const originalName = `${filename}-${IMAGE_ORIGINAL_SUFFIX}.${extension}`;
  await fs.writeFile(path.join(UPLOAD_DIR, originalName), buffer);
  return originalName;
}

/** Stores a photo with the shop's edit (crop, turn, mirror — never an image); cutting happens here. */
export async function storeProductImage(buffer: Buffer, edit: ImageEdit | null = null): Promise<StoredImage> {
  const metadata = await readImageMetadata(buffer);
  const ops = resolveImageEditOps(edit ?? IDENTITY_IMAGE_EDIT, metadata);

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = crypto.randomUUID();

  // Brightness is measured on the crop, without turn or mirror, and can never fail the upload.
  const brightness = await measureBrightness(unturned(buffer, ops)).catch(() => null);

  const originalFilename = await writeOriginal(buffer, filename, metadata.format);
  const urls = await writeSizes(buffer, filename, ops);

  return {
    filename,
    urls,
    brightness,
    originalFilename,
    originalUrl: originalFilename ? `/uploads/${originalFilename}` : null,
  };
}

/** Re-cuts a photo from its kept original (or, for an older photo, promotes the current file to be the original). */
export async function recropProductImage(
  source: { filename: string; isOriginal: boolean },
  edit: ImageEdit,
): Promise<StoredImage> {
  const buffer = await fs.readFile(path.join(UPLOAD_DIR, source.filename)).catch(() => null);
  if (!buffer) {
    throw new AppError(404, ERROR_CODES.IMAGE_ORIGINAL_MISSING);
  }

  const metadata = await readImageMetadata(buffer);
  const ops = resolveImageEditOps(edit, metadata);

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = crypto.randomUUID();
  const brightness = await measureBrightness(unturned(buffer, ops)).catch(() => null);

  // Promotion: a photo with no original makes this crop's source its original before cutting.
  const originalFilename = source.isOriginal
    ? source.filename
    : ((await writeOriginal(buffer, filename, metadata.format)) ?? source.filename);

  const urls = await writeSizes(buffer, filename, ops);

  return {
    filename,
    urls,
    brightness,
    originalFilename,
    originalUrl: `/uploads/${originalFilename}`,
  };
}

/** The largest size stored for an image — what a photo with no original is re-cut from. */
export function largestStoredFileName(filename: string): string {
  const largest = (Object.entries(IMAGE_SIZES) as [ImageSize, number][]).sort((a, b) => b[1] - a[1])[0][0];
  return `${filename}-${largest}.webp`;
}

// Best-effort; the kept original goes too, named by the caller since a re-crop gives it a different base name.
export async function deleteProductImageFiles(filename: string, originalFilename?: string | null): Promise<void> {
  const files = (Object.keys(IMAGE_SIZES) as ImageSize[]).map((size) => `${filename}-${size}.webp`);
  if (originalFilename) {
    files.push(originalFilename);
  }
  await Promise.all(files.map((file) => fs.unlink(path.join(UPLOAD_DIR, file)).catch(() => undefined)));
}

// The shop logo, fitted inside LOGO_MAX_DIMENSION as one WebP; returns the stored file name.
export async function storeLogo(buffer: Buffer): Promise<string> {
  await readImageMetadata(buffer);
  const filename = `${LOGO_FILE_PREFIX}-${crypto.randomUUID()}.webp`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await sharp(buffer)
    .autoOrient()
    .resize({ width: LOGO_MAX_DIMENSION, height: LOGO_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: IMAGE_WEBP_QUALITY })
    .toFile(path.join(UPLOAD_DIR, filename));
  return filename;
}

export async function deleteLogoFile(filename: string): Promise<void> {
  await fs.unlink(path.join(UPLOAD_DIR, path.basename(filename))).catch(() => undefined);
}

export function logoUrl(filename: string | null): string | null {
  return filename ? `/uploads/${filename}` : null;
}

const faviconFile = (base: string, size: FaviconSize): string => `${base}-${size}.png`;

// The favicon set, each size centred on a transparent square; returns the base name the files share.
export async function storeFavicon(buffer: Buffer): Promise<string> {
  await readImageMetadata(buffer);
  const base = `${FAVICON_FILE_PREFIX}-${crypto.randomUUID()}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await Promise.all(
    FAVICON_SIZES.map((size) => {
      const opaque = size === FAVICON_OPAQUE_SIZE;
      const resized = sharp(buffer)
        .autoOrient()
        .resize({
          width: size,
          height: size,
          fit: "contain",
          background: opaque ? FAVICON_OPAQUE_BACKGROUND : FAVICON_CLEAR_BACKGROUND,
        });
      return (opaque ? resized.flatten({ background: FAVICON_OPAQUE_BACKGROUND }).removeAlpha() : resized)
        .png()
        .toFile(path.join(UPLOAD_DIR, faviconFile(base, size)));
    }),
  );
  return base;
}

export async function deleteFaviconFiles(base: string): Promise<void> {
  const safe = path.basename(base);
  await Promise.all(
    FAVICON_SIZES.map((size) => fs.unlink(path.join(UPLOAD_DIR, faviconFile(safe, size))).catch(() => undefined)),
  );
}

export function faviconUrls(base: string | null): FaviconUrls | null {
  if (!base) {
    return null;
  }
  return Object.fromEntries(FAVICON_SIZES.map((size) => [size, `/uploads/${faviconFile(base, size)}`])) as FaviconUrls;
}
