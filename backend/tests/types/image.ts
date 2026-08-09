/** POST /api/images — the stored image, as routes/images.ts serializes it. */
export interface ImageDto {
  id: string;
  /** Full-size WebP, API-relative ("/uploads/<uuid>-full.webp"). */
  url: string;
  mediumUrl: string;
  thumbnailUrl: string;
  sortOrder: number;
  isPrimary: boolean;
  productId: string | null;
  variantId: string | null;
}
