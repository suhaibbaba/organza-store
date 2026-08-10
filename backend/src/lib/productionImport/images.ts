import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/image";
import { deleteOrphanedUploads, imageFileNames } from "@/lib/uploads";
import { MISSING_IMAGE_EXAMPLES } from "@/constants";
import type { ImageSyncSummary } from "@/types";

// ============================================================================
//  The photographs.
//
//  Importing the ProductImage rows alone would give the sandbox a catalogue of
//  broken images, so the files come too: every size file an imported row
//  claims is copied out of production's UPLOAD_DIR, and whatever the previous
//  catalogue left behind is removed.
//
//  Nothing here is allowed to fail the run. The database is already committed
//  by the time this starts, and a photograph that was deleted off the live
//  server months ago must not turn a successful import into an error — a
//  missing file is counted and named, not thrown.
// ============================================================================

/**
 * @param sourceDir production's uploads directory as this machine sees it, or
 *                  null when the run was told to leave the files alone.
 * @param filenames the base names the imported rows claim.
 */
export async function syncImageFiles(
  sourceDir: string | null,
  filenames: string[]
): Promise<ImageSyncSummary> {
  const claimed = new Set(filenames);

  if (sourceDir === null) {
    // Still worth clearing up after the catalogue that was just wiped: those
    // files belong to nothing at all now.
    const cleaned = await deleteOrphanedUploads(claimed);
    return {
      skipped: true,
      copied: 0,
      missing: 0,
      missingExamples: [],
      removed: cleaned.deleted,
      kept: cleaned.kept,
    };
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  let copied = 0;
  let missing = 0;
  const missingExamples: string[] = [];

  for (const filename of claimed) {
    for (const file of imageFileNames(filename)) {
      try {
        await fs.copyFile(path.join(sourceDir, file), path.join(UPLOAD_DIR, file));
        copied += 1;
      } catch {
        missing += 1;
        if (missingExamples.length < MISSING_IMAGE_EXAMPLES) missingExamples.push(file);
      }
    }
  }

  const cleaned = await deleteOrphanedUploads(claimed);

  return { skipped: false, copied, missing, missingExamples, removed: cleaned.deleted, kept: cleaned.kept };
}

/** Whether production's uploads directory is actually readable from here. */
export async function canReadUploadDir(directory: string): Promise<boolean> {
  const stat = await fs.stat(directory).catch(() => null);
  return Boolean(stat?.isDirectory());
}
