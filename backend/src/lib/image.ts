import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp, { type Sharp } from "sharp";
import { AppError } from "@/lib/response";
import { ERROR_CODES } from "@/constants";
import { IMAGE_BRIGHTNESS_MAX, IMAGE_BRIGHTNESS_MIN } from "@organza/shared/constants/numberedShawl";
import {
  IDENTITY_IMAGE_EDIT,
  resolveImageEditOps,
  type ImageEdit,
  type ImageEditOps,
} from "@organza/shared/lib/imageEdit";
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

/**
 * How light or dark this photograph is, 0 (black) to 100 (white).
 *
 * Read once, here, so that a numbered shawl's numbers can suggest their own
 * colour — white on a black abaya, dark on a cream scarf (spec.md "Numbered
 * shawls"). Measured over the WHOLE picture rather than under each number:
 * the numbers move, the suggestion is only a starting point the shop can
 * override, and one reading per photo is a great deal cheaper than one per
 * point.
 *
 * Perceived (Rec. 709) rather than a plain channel average, because green
 * carries most of what the eye reads as brightness — a saturated green
 * background is far lighter to look at than its mean says.
 *
 * Measured on the CROPPED picture, not on the file that was uploaded: the
 * numbers are drawn on what the shop kept, and a dress cut out of a dark
 * studio backdrop is a different brightness from the photograph it came from.
 *
 * Never fatal: a photo whose statistics sharp cannot produce is still a
 * perfectly good photo, and the caller falls back to the shipped marker.
 */
export async function measureBrightness(image: Sharp): Promise<number> {
  const { channels } = await image.stats();
  const [r, g, b] = channels;
  if (!r || !g || !b) throw new Error("no channel statistics");
  const luma = (BRIGHTNESS_WEIGHTS.r * r.mean + BRIGHTNESS_WEIGHTS.g * g.mean + BRIGHTNESS_WEIGHTS.b * b.mean) / 255;
  return Math.min(IMAGE_BRIGHTNESS_MAX, Math.max(IMAGE_BRIGHTNESS_MIN, Math.round(luma * IMAGE_BRIGHTNESS_MAX)));
}

/**
 * The photograph as it is LOOKED AT — its displayed size, and its format.
 *
 * Two jobs in one decode. The first is the check that used to be
 * assertDecodableImage: the multer filter upstream only reads the
 * Content-Type the client typed, so a PHP script announced as `image/png`
 * sails straight through it, and sharp refusing to decode is what actually
 * catches that. Asking here means the refusal comes out as a 400 rather than
 * as an unhandled throw, an HTTP 500 and a Sentry event.
 *
 * The second is orientation. A phone held sideways does not turn the pixels;
 * it writes an EXIF tag saying which way up the picture goes, and every
 * browser — including the one the shop framed the crop in — turns it back
 * before drawing it. The file's own width and height are then the wrong way
 * round for the frame the person was looking at, so they are swapped here and
 * the pipeline calls autoOrient() to match. Without this pair, a crop drawn
 * on a portrait phone photo would be cut out of a landscape one.
 */
async function readImageMetadata(buffer: Buffer): Promise<{ width: number; height: number; format: string }> {
  const metadata = await sharp(buffer).metadata().catch(() => null);
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

/**
 * ONE SHARP PIPELINE CARRYING THE SHOP'S EDIT — cut, resized, mirrored, turned.
 *
 * The call order below is not a preference; it is the only order that works,
 * and both halves of it were established by running sharp rather than by
 * reading about it:
 *
 *   - `autoOrient()` first, and it genuinely is first — sharp applies it
 *     ahead of everything whatever the chain says. It puts the picture the
 *     way up the browser drew it, which is the way up the crop was drawn on.
 *   - `extract` before `resize`, which is what makes it a full-quality crop:
 *     the region is cut out of the original pixels and only then scaled to
 *     the size being stored.
 *   - `resize` before `rotate`. This is the surprising one. With `rotate`
 *     called first, sharp measures the extract against the TURNED picture and
 *     a perfectly valid region is refused outright — `extract_area: bad
 *     extract area`, an HTTP 500 for a photograph that is completely fine.
 *     Resizing before turning is the same picture either way here, because
 *     every size is a square bound (see IMAGE_SIZES): the scale factor does
 *     not depend on which way round the picture is.
 *   - `flip`/`flop` before `rotate`, which is the order the editor mirrors in
 *     too — and the order the shared geometry assumes when it maps the crop
 *     back into the original file's coordinates.
 *
 * `maxDimension` is null for a pass that only wants to MEASURE the result
 * (brightness), where scaling would be wasted work.
 */
function editedPipeline(buffer: Buffer, ops: ImageEditOps, maxDimension: number | null): Sharp {
  let pipeline = sharp(buffer).autoOrient();
  if (ops.extract) pipeline = pipeline.extract(ops.extract);
  if (maxDimension !== null) {
    pipeline = pipeline.resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  if (ops.flop) pipeline = pipeline.flop();
  if (ops.flip) pipeline = pipeline.flip();
  if (ops.rotation) pipeline = pipeline.rotate(ops.rotation);
  return pipeline;
}

// Resizes into every size (max dimension, aspect preserved, never upscaled),
// converts to WebP, and writes each under UPLOAD_DIR — served statically at /uploads.
//
// Every size is cut from the ORIGINAL buffer, never from the size above it:
// three decodes of the same file cost a little more than one and are the
// difference between a crop at full quality and a crop of a crop.
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

/**
 * The edited picture as a pipeline, for a caller that wants to READ it rather
 * than store it.
 *
 * Exported so the test suite can prove that what the editor framed is what
 * this produces, through the very pipeline that ships rather than through a
 * copy of its calls — a copy would go on passing after the real one started
 * failing, and sharp's ordering rules are strict enough for that to be a real
 * risk (see above).
 */
export function editedImage(buffer: Buffer, ops: ImageEditOps, maxDimension: number | null = null): Sharp {
  return editedPipeline(buffer, ops, maxDimension);
}

/**
 * The crop, at full size and the right way up for reading statistics off —
 * the turn and the mirror left out because neither changes what is being
 * measured and both cost a pass over the pixels.
 */
function unturned(buffer: Buffer, ops: ImageEditOps): Sharp {
  return editedPipeline(buffer, { ...ops, flop: false, flip: false, rotation: 0 }, null);
}

/**
 * Keeps the file EXACTLY as it was uploaded, beside the sizes cut from it.
 *
 * Written with no sharp anywhere near it: the point of an original is that it
 * is the bytes the camera produced, so that a crop chosen months from now
 * starts from the whole picture at full quality rather than from a 2:3
 * WebP that has already been through the mill once.
 *
 * Returns null for a format we cannot name an extension for, which is not an
 * error: the photo is stored and works like any other, it simply cannot be
 * re-cropped later.
 */
async function writeOriginal(buffer: Buffer, filename: string, format: string): Promise<string | null> {
  const extension = IMAGE_ORIGINAL_EXTENSIONS[format];
  if (!extension) return null;
  const originalName = `${filename}-${IMAGE_ORIGINAL_SUFFIX}.${extension}`;
  await fs.writeFile(path.join(UPLOAD_DIR, originalName), buffer);
  return originalName;
}

/**
 * Store an uploaded photograph, with whatever the shop framed in the editor.
 *
 * `edit` is a rectangle, a quarter turn and a mirror — never an image. The
 * browser sends the file it was given, untouched, and this is where the
 * cutting happens, because a canvas re-encode on a phone hands the server a
 * picture that has already been decoded, scaled to fit a screen and
 * re-compressed. No edit at all is the ordinary case and costs nothing: the
 * pipeline is then exactly what it always was.
 *
 * The stored name is a fresh UUID and the client's own filename is never
 * touched, which is what makes path traversal impossible here rather than
 * merely unlikely: there is no caller-supplied string anywhere in the path.
 */
export async function storeProductImage(buffer: Buffer, edit: ImageEdit | null = null): Promise<StoredImage> {
  const metadata = await readImageMetadata(buffer);
  const ops = resolveImageEditOps(edit ?? IDENTITY_IMAGE_EDIT, metadata);

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = crypto.randomUUID();

  // Measured on the CROP, which is what a numbered shawl's numbers will
  // actually be drawn on — and without the turn or the mirror, because
  // neither changes how light a picture is. Never allowed to fail the upload:
  // it only decides what colour a suggestion starts at.
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

/**
 * Cut the same photograph again, differently.
 *
 * Reads the kept original off disk and produces a whole new set of sizes from
 * it — a new base name, so the URL changes and no browser, service worker or
 * image optimizer anywhere can go on showing yesterday's framing. The
 * original itself is left where it is and keeps its own name: it belongs to
 * the image, not to this crop, and the next re-crop starts from it too.
 *
 * A missing original is a plain 404 rather than a 500: it means a photo from
 * before originals were kept (or one whose file the disk lost), and the
 * screen's answer is "photograph it again", not "something broke".
 */
export async function recropProductImage(originalFilename: string, edit: ImageEdit): Promise<StoredImage> {
  const originalPath = path.join(UPLOAD_DIR, originalFilename);
  const buffer = await fs.readFile(originalPath).catch(() => null);
  if (!buffer) throw new AppError(404, ERROR_CODES.IMAGE_ORIGINAL_MISSING);

  const metadata = await readImageMetadata(buffer);
  const ops = resolveImageEditOps(edit, metadata);

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = crypto.randomUUID();
  const brightness = await measureBrightness(unturned(buffer, ops)).catch(() => null);
  const urls = await writeSizes(buffer, filename, ops);

  return {
    filename,
    urls,
    brightness,
    originalFilename,
    originalUrl: `/uploads/${originalFilename}`,
  };
}

// Best-effort cleanup — a missing file (already removed, or never fully
// written) should not block deleting the DB row.
//
// The kept original goes with the sizes: it exists to serve one image row,
// and a row that has gone leaves nothing that could ever be cut from it
// again. Its name is passed in rather than derived, because after a re-crop
// the original's base name and the row's `filename` are deliberately
// different (see recropProductImage).
export async function deleteProductImageFiles(
  filename: string,
  originalFilename?: string | null
): Promise<void> {
  const files = (Object.keys(IMAGE_SIZES) as ImageSize[]).map((size) => `${filename}-${size}.webp`);
  if (originalFilename) files.push(originalFilename);
  await Promise.all(files.map((file) => fs.unlink(path.join(UPLOAD_DIR, file)).catch(() => undefined)));
}
