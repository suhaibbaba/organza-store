import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";
import {
  DEFAULT_ALLOWED_IMAGE_TYPES,
  DEFAULT_UPLOAD_DIR,
  DEFAULT_UPLOAD_MAX_SIZE_MB,
  IMAGE_SIZES,
  IMAGE_WEBP_QUALITY,
} from "@/constants";
import type { ImageSize, StoredImage } from "@/types";

// CLAUDE.md rule: images stored locally on the VPS, optimized with sharp
// (WebP + multi-size) on upload. Sizes: thumbnail (lists), medium (POS), full (product page).
//
// RESOLVED AGAINST THE WORKING DIRECTORY, which is why the deployment sets it
// absolutely. A relative UPLOAD_DIR means "wherever this process happens to
// have been started from" — in the container that is /app/backend, one level
// below the mount at /app/uploads, so every photo landed in the container's
// own layer and was thrown away by the next deploy. Nothing failed; the files
// simply stopped existing. docker-compose.sandbox.yml now sets
// UPLOAD_DIR=/app/uploads in `environment:` so the app's path and the mount
// point are the same two lines in one file.
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? DEFAULT_UPLOAD_DIR);
export const UPLOAD_MAX_SIZE_MB = Number(process.env.UPLOAD_MAX_SIZE_MB ?? DEFAULT_UPLOAD_MAX_SIZE_MB);
export const ALLOWED_IMAGE_TYPES = (process.env.ALLOWED_IMAGE_TYPES ?? DEFAULT_ALLOWED_IMAGE_TYPES.join(","))
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

/**
 * Can this process actually keep a photograph?
 *
 * Creates UPLOAD_DIR if it is missing and then proves it is writable by
 * writing a file and deleting it — `access(W_OK)` answers a different, weaker
 * question (it trusts the permission bits, and says nothing about a read-only
 * mount or a full disk).
 *
 * This runs at STARTUP, not at the first upload, because the failure it is
 * looking for is a deployment failure and deployments are the moment somebody
 * is watching. The classic one: a volume mounted into a container whose user
 * cannot write to it — the directory belongs to root, the app runs as someone
 * else, and every upload has failed since the rebuild while everything else
 * carries on working perfectly. "It worked yesterday" is not a diagnosis, and
 * without this the first person to find out is a member of staff holding a
 * phone in one hand and a dress in the other.
 *
 * Deliberately NOT fatal. A shop that cannot add photos can still sell,
 * refund, count its drawer and print labels; refusing to start would turn a
 * lost feature into a closed shop.
 */
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

// Resizes into every size (max dimension, aspect preserved, never upscaled),
// converts to WebP, and writes each under UPLOAD_DIR — served statically at /uploads.
export async function storeProductImage(buffer: Buffer): Promise<StoredImage> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = crypto.randomUUID();
  const urls = {} as Record<ImageSize, string>;

  for (const [size, maxDimension] of Object.entries(IMAGE_SIZES) as [ImageSize, number][]) {
    const outputName = `${filename}-${size}.webp`;
    await sharp(buffer)
      .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
      .webp({ quality: IMAGE_WEBP_QUALITY })
      .toFile(path.join(UPLOAD_DIR, outputName));
    urls[size] = `/uploads/${outputName}`;
  }

  return { filename, urls };
}

// Best-effort cleanup — a missing file (already removed, or never fully
// written) should not block deleting the DB row.
export async function deleteProductImageFiles(filename: string): Promise<void> {
  await Promise.all(
    (Object.keys(IMAGE_SIZES) as ImageSize[]).map((size) =>
      fs.unlink(path.join(UPLOAD_DIR, `${filename}-${size}.webp`)).catch(() => undefined)
    )
  );
}
