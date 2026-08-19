import type { IMAGE_SIZES } from "@/constants";

export type ImageSize = keyof typeof IMAGE_SIZES;

export interface StoredImage {
  filename: string;
  urls: Record<ImageSize, string>;
  // Perceived brightness of the photograph, 0-100 (see measureBrightness).
  // Kept on the row so the numbers drawn on a numbered shawl can suggest
  // their own colour without re-reading the file (spec.md "Numbered shawls").
  // Null when sharp could not produce statistics for it — the numbers then
  // keep the marker this feature shipped with rather than guessing.
  brightness: number | null;
}
