import { API_BASE_URL } from "@/lib/env";

/**
 * Which image URLs have already failed to load, for as long as this tab is
 * open.
 *
 * Product photos live on the API host, and a URL that 404s once will 404
 * again. Without this, every re-render asks for it afresh — and a product
 * list re-renders on every filter change, every refetch and every scroll that
 * remounts a row, so one deleted photo turns into a steady drip of failing
 * requests and a thumbnail that flickers from placeholder to broken and back.
 * Remembered here instead, so the second render onwards draws the placeholder
 * immediately and asks for nothing.
 *
 * Deliberately module-level rather than React state: it outlives the
 * components that discover it, which is the whole point, and it costs one
 * string per broken photo. It is not persisted — a reload is exactly when a
 * re-uploaded photo deserves another chance.
 */
const failedImageUrls = new Set<string>();

/**
 * The URL an image actually loads from.
 *
 * Stored paths are API-relative ("/uploads/.."), and the backend serves them,
 * so they resolve against the API origin rather than the admin's. Anything
 * already absolute is left alone.
 */
export function resolveImageUrl(src: string): string {
  return src.startsWith("http") ? src : `${API_BASE_URL}${src}`;
}

export function hasImageFailed(url: string): boolean {
  return failedImageUrls.has(url);
}

export function markImageFailed(url: string): void {
  failedImageUrls.add(url);
}
