/** POST /api/images — the stored image, as routes/images.ts serializes it. */
export interface ImageDto {
  id: string;
  /** Full-size WebP, API-relative ("/uploads/<uuid>-full.webp"). */
  url: string;
  mediumUrl: string;
  thumbnailUrl: string;
  /**
   * The photograph exactly as it was uploaded, kept so a different crop can
   * be cut from it later (spec.md "Editing a photograph on upload"). Null on
   * anything stored before the editor existed.
   */
  originalUrl: string | null;
  /** The crop, quarter turn and mirrors the shop framed, if any. */
  edit: { crop: { x: number; y: number; width: number; height: number } | null; rotation: number } | null;
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
