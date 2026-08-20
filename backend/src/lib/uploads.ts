import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/image";
import { IMAGE_ORIGINAL_FILE_PATTERN, IMAGE_SIZES } from "@/constants";
import type { ImageSize } from "@/types";

/** The two file names one ProductImage row knows itself by. */
export interface ImageFileRef {
  filename: string;
  originalFilename?: string | null;
}

/**
 * Uploaded files nobody's row claims any more.
 *
 * A stored image is one base name and three files
 * (`<name>-thumbnail.webp`, `-medium`, `-full`), plus the original it was cut
 * from (`<name>-original.jpg`), so a file belongs to a row when its base name
 * matches one this row claims.
 *
 * The original's base name is usually the same as the row's `filename` and,
 * after a re-crop, deliberately is not: re-cropping mints new derived files
 * under a new name so no cache anywhere can go on serving the old framing,
 * while the original stays where it is. Hence `claimedImageBases` below
 * rather than a set of `filename` values — a set built the old way would
 * count every re-cropped photo's original as rubbish and delete the one file
 * that cannot be reproduced.
 *
 * Shared by the two commands that leave the uploads folder out of step with
 * the database: `db:reset` (which empties the database, so every file is
 * orphaned) and `import:prod` (which replaces the catalogue, so the previous
 * catalogue's photographs are). Gigabytes of pictures of nothing, either way.
 */
export async function deleteOrphanedUploads(claimed: Set<string>): Promise<{ deleted: number; kept: number }> {
  let entries: string[];
  try {
    entries = await fs.readdir(UPLOAD_DIR);
  } catch {
    // No uploads folder yet — nothing to clean.
    return { deleted: 0, kept: 0 };
  }

  let deleted = 0;
  let kept = 0;
  for (const entry of entries) {
    const base = entry
      .replace(/-(thumbnail|medium|full)\.webp$/, "")
      .replace(IMAGE_ORIGINAL_FILE_PATTERN, "");
    if (claimed.has(base)) {
      kept += 1;
      continue;
    }
    const target = path.join(UPLOAD_DIR, entry);
    const stat = await fs.stat(target).catch(() => null);
    // Only files. A directory in here is not something these commands
    // invented and not something they will remove.
    if (!stat?.isFile()) continue;
    await fs.unlink(target).catch(() => undefined);
    deleted += 1;
  }

  return { deleted, kept };
}

/** Every file one stored image is made of — its three sizes and its original. */
export function imageFileNames(image: ImageFileRef): string[] {
  const files = (Object.keys(IMAGE_SIZES) as ImageSize[]).map((size) => `${image.filename}-${size}.webp`);
  if (image.originalFilename) files.push(image.originalFilename);
  return files;
}

/**
 * Every base name a set of image rows claims — what a sweep must not delete.
 *
 * Two per row rather than one, because a re-cropped photo's original keeps
 * the base name it was first stored under (see above).
 */
export function claimedImageBases(images: ImageFileRef[]): Set<string> {
  const claimed = new Set<string>();
  for (const image of images) {
    claimed.add(image.filename);
    if (image.originalFilename) {
      claimed.add(image.originalFilename.replace(IMAGE_ORIGINAL_FILE_PATTERN, ""));
    }
  }
  return claimed;
}
