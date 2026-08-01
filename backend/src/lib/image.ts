import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";

// CLAUDE.md rule: images stored locally on the VPS, optimized with sharp
// (WebP + multi-size) on upload. Sizes: thumbnail (lists), medium (POS), full (product page).
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
export const UPLOAD_MAX_SIZE_MB = Number(process.env.UPLOAD_MAX_SIZE_MB ?? 10);
export const ALLOWED_IMAGE_TYPES = (process.env.ALLOWED_IMAGE_TYPES ?? "image/jpeg,image/png,image/webp")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const SIZES = {
  thumbnail: 300,
  medium: 800,
  full: 1600,
} as const;

export type ImageSize = keyof typeof SIZES;

export interface StoredImage {
  filename: string;
  urls: Record<ImageSize, string>;
}

// Resizes into every size (max dimension, aspect preserved, never upscaled),
// converts to WebP, and writes each under UPLOAD_DIR — served statically at /uploads.
export async function storeProductImage(buffer: Buffer): Promise<StoredImage> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = crypto.randomUUID();
  const urls = {} as Record<ImageSize, string>;

  for (const [size, maxDimension] of Object.entries(SIZES) as [ImageSize, number][]) {
    const outputName = `${filename}-${size}.webp`;
    await sharp(buffer)
      .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(UPLOAD_DIR, outputName));
    urls[size] = `/uploads/${outputName}`;
  }

  return { filename, urls };
}

// Best-effort cleanup — a missing file (already removed, or never fully
// written) should not block deleting the DB row.
export async function deleteProductImageFiles(filename: string): Promise<void> {
  await Promise.all(
    (Object.keys(SIZES) as ImageSize[]).map((size) =>
      fs.unlink(path.join(UPLOAD_DIR, `${filename}-${size}.webp`)).catch(() => undefined)
    )
  );
}
