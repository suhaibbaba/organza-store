import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { type ImageEdit, type ImageEditOps, resolveImageEditOps } from '@organza/shared';
import sharp, { type Sharp } from 'sharp';
import { badRequest, notFound } from '../../../common/lib/app-error.js';
import { env } from '../../../config/env.js';
import { IMAGE_SIZES, type ImageSize, sizeFilename } from './image-urls.js';

export const IMAGE_ERRORS = {
  INVALID: 'IMAGE_INVALID',
  ORIGINAL_MISSING: 'IMAGE_ORIGINAL_MISSING',
} as const;
const WEBP_QUALITY = 82;
const ORIGINAL_EXTENSIONS: Record<string, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' };
/** EXIF orientations stored on their side: width and height are swapped as displayed. */
const SIDEWAYS = [5, 6, 7, 8];
const LUMA = { r: 0.2126, g: 0.7152, b: 0.0722 };

export const uploadDir = () => resolve(env().UPLOAD_DIR);

export interface StoredImage {
  filename: string;
  originalFilename: string | null;
  brightness: number | null;
}

/** Decoding is the real type check: a script named .png fails here and becomes a 400. */
async function metadataOf(buffer: Buffer) {
  const meta = await sharp(buffer)
    .metadata()
    .catch(() => null);
  if (!meta?.format || !meta.width || !meta.height || !ORIGINAL_EXTENSIONS[meta.format]) {
    throw badRequest(IMAGE_ERRORS.INVALID, 'Not a JPEG, PNG or WebP image');
  }
  const sideways = SIDEWAYS.includes(meta.orientation ?? 1);
  return {
    width: sideways ? meta.height : meta.width,
    height: sideways ? meta.width : meta.height,
    format: meta.format,
  };
}

/** Order matters: orient, cut from full-quality pixels, resize, then mirror and turn. */
function pipeline(buffer: Buffer, ops: ImageEditOps, maxSide: number | null): Sharp {
  let p = sharp(buffer).autoOrient();
  if (ops.extract) p = p.extract(ops.extract);
  if (maxSide !== null)
    p = p.resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true });
  if (ops.flop) p = p.flop();
  if (ops.flip) p = p.flip();
  if (ops.rotation) p = p.rotate(ops.rotation);
  return p;
}

/** Perceived brightness (Rec. 709) of the kept crop, 0–100; suggests numbered-marker colours. */
async function brightnessOf(buffer: Buffer, ops: ImageEditOps): Promise<number | null> {
  try {
    const { channels } = await pipeline(
      buffer,
      { ...ops, flop: false, flip: false, rotation: 0 },
      400,
    ).stats();
    const [r, g, b] = channels;
    if (!r || !g || !b) return null;
    return Math.round(((LUMA.r * r.mean + LUMA.g * g.mean + LUMA.b * b.mean) / 255) * 100);
  } catch {
    return null;
  }
}

async function writeSizes(buffer: Buffer, filename: string, ops: ImageEditOps): Promise<void> {
  for (const [size, max] of Object.entries(IMAGE_SIZES) as [ImageSize, number][]) {
    await pipeline(buffer, ops, max)
      .webp({ quality: WEBP_QUALITY })
      .toFile(join(uploadDir(), sizeFilename(filename, size)));
  }
}

export async function storeImage(buffer: Buffer, edit: ImageEdit): Promise<StoredImage> {
  const meta = await metadataOf(buffer);
  const ops = resolveImageEditOps(edit, meta);
  await mkdir(uploadDir(), { recursive: true });
  const filename = randomUUID();
  // The upload is kept byte for byte so it can be re-cropped later.
  const originalFilename = `${filename}-original.${ORIGINAL_EXTENSIONS[meta.format]}`;
  await writeFile(join(uploadDir(), originalFilename), buffer);
  await writeSizes(buffer, filename, ops);
  return { filename, originalFilename, brightness: await brightnessOf(buffer, ops) };
}

/** A new framing cut from the kept original; new file names so caches never show the old crop. */
export async function recropImage(originalFilename: string, edit: ImageEdit): Promise<StoredImage> {
  const buffer = await readFile(join(uploadDir(), originalFilename)).catch(() => null);
  if (!buffer) throw notFound('Original image', IMAGE_ERRORS.ORIGINAL_MISSING);
  const meta = await metadataOf(buffer);
  const ops = resolveImageEditOps(edit, meta);
  const filename = randomUUID();
  await writeSizes(buffer, filename, ops);
  return { filename, originalFilename, brightness: await brightnessOf(buffer, ops) };
}

export async function deleteSizes(filename: string): Promise<void> {
  await Promise.all(
    (Object.keys(IMAGE_SIZES) as ImageSize[]).map((s) =>
      unlink(join(uploadDir(), sizeFilename(filename, s))).catch(() => undefined),
    ),
  );
}

/** Startup probe: can we actually write photos? Logged, never fatal (the shop can still sell). */
export async function uploadDirWritable(): Promise<true | Error> {
  const probe = join(uploadDir(), `.probe-${randomUUID()}`);
  try {
    await mkdir(uploadDir(), { recursive: true });
    await writeFile(probe, '');
    return true;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  } finally {
    await unlink(probe).catch(() => undefined);
  }
}
