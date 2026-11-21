import type { BarcodeSource } from "@store/shared/types/product";
import type { ProductImageRef } from "@store/shared/types/variant";
import type { ImageEdit } from "@store/shared/lib/imageEdit";

// Always strings so inputs stay controlled; turned into I18n at submit.
export interface I18nFormValue {
  ar: string;
  en: string;
  he: string;
}

// Rows keyed by a caller-owned string: the value id, or a point id for a number placed in this save.
export interface OptionValueNoteGroup {
  id: string;
  typeName: string;
  rows: { key: string; label: string }[];
}

// Converted to the API's optionSelections (rule 2: values referenced by id).
export type VariantSelectionMap = Record<string, string[]>;

// The backend gates each field separately (rule 5), so payloads omit what the user can't set.
export interface ProductEditAbilities {
  canEditPrice: boolean;
  canEditCost: boolean;
  canEditStock: boolean;
  canHide: boolean;
}

// A stored image or a picked file, both with a stable id for dnd-kit; nothing uploads until Save.
export type GallerySlot =
  | {
      kind: "existing";
      id: string;
      image: ProductImageRef;
      isPrimary: boolean;
      // Unsent until Save; null means leave it, which differs from the identity edit (that would re-cut).
      edit?: ImageEdit | null;
      // Null when the browser couldn't draw one; the stored thumbnail shows until the save returns.
      previewUrl?: string | null;
    }
  | {
      kind: "new";
      id: string;
      file: File;
      previewUrl: string;
      // Always the file as picked, so a second crop starts from the whole photo.
      sourceUrl: string;
      isPrimary: boolean;
      edit: ImageEdit | null;
    };

export interface Gallery {
  slots: GallerySlot[];
  saved: ProductImageRef[];
}

// The API forces the order: product, then variants, then photos.
export type SaveStep = { kind: "product" } | { kind: "variants" } | { kind: "images"; done: number; total: number };

// Data, not an exception: a failed photo must not undo the saved product; slots stay retryable.
export interface ImageSyncOutcome {
  // Server truth after the attempt, in order.
  images: ProductImageRef[];
  slots: GallerySlot[];
  // Photos still waiting to upload after this attempt.
  pendingCount: number;
  // Deletions waiting for approval: not an error, the photo stays until decided.
  awaitingApproval: number;
  // First error hit, as an `error.*` key for t() (CLAUDE.md rule 12).
  errorCode: string | null;
}

// An empty priceOverride/cost means inherit from the parent (rule 3).
export interface VariantEditValues {
  stock: string;
  priceOverride: string;
  cost: string;
  isActive: boolean;
  // `barcode` holds only the supplier's code, kept across a toggle so flipping back doesn't wipe a scan.
  barcodeSource: BarcodeSource;
  barcode: string;
}
