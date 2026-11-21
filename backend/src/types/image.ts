import type { IMAGE_SIZES } from "@/constants";

export type ImageSize = keyof typeof IMAGE_SIZES;

export interface StoredImage {
  filename: string;
  urls: Record<ImageSize, string>;
  // Photo brightness 0-100 for numbered-shawl marker colours; null when sharp could not measure it.
  brightness: number | null;
  // The untouched upload (`<uuid>-original.<ext>`) and its URL, for re-crops; null for an unnamed format.
  originalFilename: string | null;
  originalUrl: string | null;
}

// Product.markedImage as stored: the URLs the apps read, plus the base name and what it was drawn from.
export interface StoredMarkedImage {
  filename: string;
  signature: string;
  url: string;
  mediumUrl: string;
  thumbnailUrl: string;
}

export type { FaviconSize, FaviconUrls } from "@store/shared/types/setting";
