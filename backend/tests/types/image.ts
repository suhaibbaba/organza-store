/** POST /api/images — the stored image, as routes/images.ts serializes it. */
export interface ImageDto {
  id: string;
  /** Full-size WebP, API-relative ("/uploads/<uuid>-full.webp"). */
  url: string;
  mediumUrl: string;
  thumbnailUrl: string;
  sortOrder: number;
  isPrimary: boolean;
  /**
   * How light or dark the photograph is, 0-100, measured by sharp at upload.
   * What a numbered shawl's markers read to suggest their own colour. Null
   * for a photo uploaded before it was measured.
   */
  brightness: number | null;
  productId: string | null;
  variantId: string | null;
}
