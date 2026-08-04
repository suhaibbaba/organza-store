import type { I18n } from "@/types/common";
import type { CategoryRef } from "@/types/category";
import type { ProductImageRef, Variant } from "@/types/variant";

export interface ProductVariantTypeRef {
  id: string;
  name: I18n;
  slug: string;
}

// Full detail DTO (GET /api/products/:id), including all variants resolved.
export interface Product {
  id: string;
  productNumber: number;
  name: I18n;
  slug: string;
  description: I18n | null;
  category: CategoryRef | null;
  basePrice: string;
  compareAtPrice: string | null;
  // Simple-product-only fields (CLAUDE.md: disabled once the product has variants).
  sku: string | null;
  barcode: string | null;
  stock?: number;
  isActive: boolean;
  // Opt-in low-stock alerts: only flagged products are measured against
  // Setting.lowStockThreshold (inventory low-stock view + dashboard count).
  // Off by default, since most products are one-off pieces with stock = 1.
  trackLowStock: boolean;
  deletedAt: string | null;
  hasVariants: boolean;
  images: ProductImageRef[];
  variantTypes: ProductVariantTypeRef[];
  variants: Variant[];
  createdAt: string;
  updatedAt: string;
  // SENSITIVE (CLAUDE.md rule 19): Admin + Manager only — absent entirely
  // from Employee responses.
  cost?: string | null;
}

// Lighter list-view DTO (GET /api/products) — aggregate stock, variant count,
// no per-variant breakdown.
export interface ProductSummary {
  id: string;
  productNumber: number;
  name: I18n;
  slug: string;
  category: CategoryRef | null;
  basePrice: string;
  compareAtPrice: string | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  isActive: boolean;
  trackLowStock: boolean;
  hasVariants: boolean;
  variantCount: number;
  // Numbered products (spec.md "Numbered shawls"): the numbers themselves are
  // illegible on a list thumbnail, so the list UI labels the product type with
  // a badge instead. `numberCount` is how many distinct numbers it offers.
  isNumbered: boolean;
  numberCount: number;
  image: ProductImageRef | null;
  createdAt: string;
  updatedAt: string;
  cost?: string | null;
}

// GET /api/products/lookup?code=… — what a POS scan resolves to. `variant`
// is the exact variant whose barcode/SKU matched; it is null when the code
// belonged to a simple product, which is itself the purchasable item.
export interface ProductLookupResult {
  product: Product;
  variant: Variant | null;
}
