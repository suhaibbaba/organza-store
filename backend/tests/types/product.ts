// Mirrors the DTOs built by backend/src/lib/pricing.ts's serializeProduct /
// serializeVariant / serializeProductSummary. Those serializers build plain
// (AnyRecord) objects rather than exporting a named response type, so these
// live here — under the tests' own types directory — instead of being
// redeclared inline in every test file that hits /api/products.
export interface ProductVariantDto {
  id: string;
  name: { ar: string; en?: string; he?: string };
  sku: string;
  barcode: string | null;
  // Ours or the supplier's (shared/constants/barcode.ts) — stored per variant,
  // never inferred from the code.
  barcodeSource: "GENERATED" | "SUPPLIER";
  priceOverride: number | string | null;
  resolvedPrice: number | string;
  stock?: number;
  // Numbered shawls (spec.md): point on the product image, percentage 0-100.
  // Null for ordinary (non-numbered) variants.
  imageX?: number | null;
  imageY?: number | null;
  values: { id: string }[];
  // Role-gated (CLAUDE.md rule 19): absent entirely for Employee responses.
  cost?: number | string | null;
  resolvedCost?: number | string | null;
}

import type { ChangeRequestDto } from "@tests/types/changeRequest";

export interface ProductDto {
  id: string;
  name: { ar: string; en?: string; he?: string };
  // Nested category the product is filed under, as the detail DTO returns it.
  category: { id: string; name: Record<string, string>; slug: string } | null;
  sku: string | null;
  barcode: string | null;
  barcodeSource: "GENERATED" | "SUPPLIER";
  hasVariants: boolean;
  basePrice: number | string;
  compareAtPrice: number | string | null;
  isActive: boolean;
  stock?: number;
  // Opt-in low-stock alerts; false unless the caller both asked for it and
  // has the permission to set it.
  trackLowStock: boolean;
  // The product's explicit "this sells numbers, nothing else" choice
  // (spec.md "Numbered shawls"). False unless it was asked for.
  isNumbered: boolean;
  // Whatever is still waiting for an Admin on this product, its variants or
  // its photos (spec.md "Employee change approvals"). Present on every
  // product response; empty when nothing is held.
  pendingChanges?: ChangeRequestDto[];
  // The gallery, lowest sortOrder first. Only the id is asserted against
  // today (the photo-deletion approval), so only the shape that needs
  // asserting is declared.
  images: { id: string; url: string; thumbnailUrl: string; isPrimary: boolean }[];
  // Null until the product's barcode labels have been printed at least once.
  labelsPrintedAt: string | null;
  // Soft delete (CLAUDE.md rule 4) — a product is hidden, never destroyed.
  deletedAt: string | null;
  variants: ProductVariantDto[];
  // Role-gated (CLAUDE.md rule 19): absent entirely for Employee responses.
  cost?: number | string | null;
}

// Lighter list-view shape (GET /api/products).
export interface ProductSummaryDto {
  id: string;
  basePrice: number | string;
  labelsPrintedAt: string | null;
  barcode: string | null;
  barcodeSource: "GENERATED" | "SUPPLIER";
  // Whether a label of ours is still owed — false once every code the product
  // would print is the supplier's own.
  needsLabel: boolean;
}

// One number of a numbered shawl, as the lookup hands it to the POS.
export interface ProductNumberOptionDto {
  variantId: string;
  variantNumber: number;
  number: { ar: string; en?: string; he?: string };
  numberKey: string;
  sku: string;
  barcode: string | null;
  resolvedPrice: number | string;
  stock: number;
  available: boolean;
  imageX: number | null;
  imageY: number | null;
}

// GET /api/products/lookup?code=… — one scanned code resolved to what is
// actually being sold. kind ITEM: `variant` is the matched variant, or null
// for a simple product (which is itself the purchasable item). kind
// VARIANT_SELECTION: the parent of a product that has variants — a numbered
// shawl's collection label, or a supplier's one code for every size — so
// nothing sellable comes back: `variant` is null, and `numbers` holds the
// choices for a numbered product (empty for an ordinary one, whose variants
// are picked from `product.variants`).
export interface ProductLookupDto {
  kind: "ITEM" | "VARIANT_SELECTION";
  product: ProductDto;
  variant: ProductVariantDto | null;
  numbers: ProductNumberOptionDto[];
}

// POST /api/products/labels/printed.
export interface MarkLabelsPrintedDto {
  productIds: string[];
  labelsPrintedAt: string;
}
