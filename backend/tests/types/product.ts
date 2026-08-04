// Mirrors the DTOs built by backend/src/lib/pricing.ts's serializeProduct /
// serializeVariant / serializeProductSummary. Those serializers build plain
// (AnyRecord) objects rather than exporting a named response type, so these
// live here — under the tests' own types directory — instead of being
// redeclared inline in every test file that hits /api/products.
export interface ProductVariantDto {
  id: string;
  sku: string;
  barcode: string | null;
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

export interface ProductDto {
  id: string;
  sku: string | null;
  barcode: string | null;
  hasVariants: boolean;
  basePrice: number | string;
  stock?: number;
  // Opt-in low-stock alerts; false unless the caller both asked for it and
  // has the permission to set it.
  trackLowStock: boolean;
  variants: ProductVariantDto[];
  // Role-gated (CLAUDE.md rule 19): absent entirely for Employee responses.
  cost?: number | string | null;
}

// Lighter list-view shape (GET /api/products).
export interface ProductSummaryDto {
  id: string;
  basePrice: number | string;
}

// GET /api/products/lookup?code=… — one scanned code resolved to the exact
// item being sold. `variant` is null for a simple product, which is itself
// the purchasable item.
export interface ProductLookupDto {
  product: ProductDto;
  variant: ProductVariantDto | null;
}
