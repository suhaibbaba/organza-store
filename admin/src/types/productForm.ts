import type { ProductImageRef } from "@shared/types/variant";

// Raw <input> values for the translatable name/description fields — always
// plain strings (never undefined) so controlled inputs never warn; sanitized
// into a real I18n object only at submit time (see lib/validation/product-form.ts).
export interface I18nFormValue {
  ar: string;
  en: string;
  he: string;
}

// Selected global option values per variant type, keyed by variantTypeId —
// the UI's working shape for the picker; converted to the API's
// `optionSelections` array (CLAUDE.md rule 2: values are referenced by id).
export type VariantSelectionMap = Record<string, string[]>;

// What the signed-in user may actually write on a product or a variant.
// The backend gates each of these fields separately (product.editPrice,
// inventory.adjust, product.hide, product.viewCost — CLAUDE.md rule 5), so
// the payload builders leave out whatever the user can't set instead of
// resending a value that would be refused or, worse, blanked.
export interface ProductEditAbilities {
  canEditPrice: boolean;
  canEditCost: boolean;
  canEditStock: boolean;
  canHide: boolean;
}

// One slot in a working gallery: either an image already on the server, or a
// file the user has picked that hasn't been uploaded yet. Both carry a stable
// `id` (the server id, or a temporary one) so dnd-kit can track them and the
// primary flag can point at either kind. Nothing is uploaded until the
// product form's single Save runs.
export type GallerySlot =
  | { kind: "existing"; id: string; image: ProductImageRef; isPrimary: boolean }
  | { kind: "new"; id: string; file: File; previewUrl: string; isPrimary: boolean };

// One gallery being edited — the product's own, or one variant's — as the
// working copy plus the server state it is diffed against.
export interface Gallery {
  slots: GallerySlot[];
  saved: ProductImageRef[];
}

// Which part of the one Save is running, for the single progress line the
// user sees. The three stages are forced by the API: the product row, then
// its variants, then the photos that hang on them.
export type SaveStep =
  | { kind: "product" }
  | { kind: "variants" }
  | { kind: "images"; done: number; total: number };

// What one gallery's save attempt actually achieved. Deliberately not an
// exception: a photo that didn't upload must not undo the product that did
// (CLAUDE.md: the user is told plainly what happened), so a failure comes
// back as data — with the slots left in a state a retry can pick up.
export interface ImageSyncOutcome {
  // Server truth after the attempt, in order.
  images: ProductImageRef[];
  // What the gallery should now show: uploads that worked as saved images,
  // anything that failed still pending.
  slots: GallerySlot[];
  // Photos still waiting to upload after this attempt.
  pendingCount: number;
  // Photos whose DELETION is waiting for an Admin (spec.md "Employee change
  // approvals"). Not an error: the request was filed and the photo stays in
  // the gallery until somebody decides.
  awaitingApproval: number;
  // First error hit, as an `error.*` key for t() (CLAUDE.md rule 12).
  errorCode: string | null;
}

// Local, unsaved edits to an existing variant row (edit mode). Empty string
// on priceOverride/cost means "inherit from parent" (CLAUDE.md rule 3).
export interface VariantEditValues {
  stock: string;
  priceOverride: string;
  cost: string;
  isActive: boolean;
}
