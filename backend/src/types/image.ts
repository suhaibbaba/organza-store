import type { IMAGE_SIZES } from "@/constants";

export type ImageSize = keyof typeof IMAGE_SIZES;

export interface StoredImage {
  filename: string;
  urls: Record<ImageSize, string>;
}
