import type { ImageView } from '@organza/shared';
import type { productImages } from '../../../database/schema/index.js';

export const IMAGE_SIZES = { thumbnail: 300, medium: 800, full: 1600 } as const;
export type ImageSize = keyof typeof IMAGE_SIZES;

export const sizeFilename = (filename: string, size: ImageSize) => `${filename}-${size}.webp`;
export const uploadUrl = (name: string) => `/uploads/${name}`;

export function imageView(row: typeof productImages.$inferSelect): ImageView {
  return {
    id: row.id,
    itemId: row.itemId,
    thumbnailUrl: uploadUrl(sizeFilename(row.filename, 'thumbnail')),
    mediumUrl: uploadUrl(sizeFilename(row.filename, 'medium')),
    fullUrl: uploadUrl(sizeFilename(row.filename, 'full')),
    originalUrl: row.originalFilename ? uploadUrl(row.originalFilename) : null,
    isPrimary: row.isPrimary,
    brightness: row.brightness,
  };
}
