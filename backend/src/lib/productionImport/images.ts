import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/image";
import { claimedImageBases, deleteOrphanedUploads, imageFileNames, type ImageFileRef } from "@/lib/uploads";
import { MISSING_IMAGE_EXAMPLES } from "@/constants";
import type { ImageSyncSummary } from "@/types";

// Copies the photo files imported rows claim and removes leftovers; never fails the run, the database is already committed.

/** Originals come across with the three sizes, or the sandbox could not re-crop; sourceDir null means skip the files. */
export async function syncImageFiles(
  sourceDir: string | null,
  images: ImageFileRef[],
  keepFiles: string[] = [],
): Promise<ImageSyncSummary> {
  const claimed = claimedImageBases(images);
  // Files the sandbox keeps of its own (its settings stay), e.g. the shop logo.
  for (const file of keepFiles) {
    claimed.add(file);
  }

  if (sourceDir === null) {
    // Still worth clearing up after the catalogue that was just wiped: those files belong to nothing at all now.
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

  for (const image of images) {
    for (const file of imageFileNames(image)) {
      try {
        await fs.copyFile(path.join(sourceDir, file), path.join(UPLOAD_DIR, file));
        copied += 1;
      } catch {
        missing += 1;
        if (missingExamples.length < MISSING_IMAGE_EXAMPLES) {
          missingExamples.push(file);
        }
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
