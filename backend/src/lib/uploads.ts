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

/** Files no row claims: an image is a base name with three sizes plus an original (maybe an older base name). */
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
    const base = entry.replace(/-(thumbnail|medium|full)\.webp$/, "").replace(IMAGE_ORIGINAL_FILE_PATTERN, "");
    if (claimed.has(base)) {
      kept += 1;
      continue;
    }
    const target = path.join(UPLOAD_DIR, entry);
    const stat = await fs.stat(target).catch(() => null);
    // Only files; directories are never removed.
    if (!stat?.isFile()) {
      continue;
    }
    await fs.unlink(target).catch(() => undefined);
    deleted += 1;
  }

  return { deleted, kept };
}

/** Every file one stored image is made of — its three sizes and its original. */
export function imageFileNames(image: ImageFileRef): string[] {
  const files = (Object.keys(IMAGE_SIZES) as ImageSize[]).map((size) => `${image.filename}-${size}.webp`);
  if (image.originalFilename) {
    files.push(image.originalFilename);
  }
  return files;
}

/** Every base name a set of rows claims — two per row, since an original keeps its first base name. */
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
