import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/image";
import { IMAGE_SIZES } from "@/constants";
import type { ImageSize } from "@/types";

/**
 * Uploaded files nobody's row claims any more.
 *
 * A stored image is one base name and three files
 * (`<name>-thumbnail.webp`, `-medium`, `-full`), so a file belongs to a row
 * when its base name matches that row's `filename`.
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
    const base = entry.replace(/-(thumbnail|medium|full)\.webp$/, "");
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

/** Every size file one stored image is made of, by base name. */
export function imageFileNames(filename: string): string[] {
  return (Object.keys(IMAGE_SIZES) as ImageSize[]).map((size) => `${filename}-${size}.webp`);
}
