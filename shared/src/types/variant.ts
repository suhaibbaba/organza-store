import type { I18n } from "@/types/common";

// Global option value (e.g. Color -> "أحمر"), GET /api/variant-types.
export interface VariantOptionValue {
  id: string;
  variantTypeId: string;
  value: I18n;
  key: string;
  sortOrder: number;
  createdAt: string;
}

// Global variant type (e.g. Color, Size, Number) with its values, shared
// across all products (CLAUDE.md: "Number/الأرقام" is not special — it's a
// normal variant type). GET /api/variant-types.
export interface VariantType {
  id: string;
  name: I18n;
  slug: string;
  values: VariantOptionValue[];
  createdAt: string;
}

export interface ProductImageRef {
  id: string;
  url: string;
  mediumUrl: string;
  thumbnailUrl: string;
  sortOrder: number;
  isPrimary: boolean;
}

// A variant's resolved reference to a global option value (CLAUDE.md rule 2)
// — the value is looked up by id, never copied as text.
export interface VariantOptionValueRef {
  id: string;
  variantTypeId: string;
  value: I18n;
  key: string;
}

export interface Variant {
  id: string;
  variantNumber: number;
  name: I18n;
  sku: string;
  barcode: string | null;
  // Fallback rule (CLAUDE.md rule 3): null on the variant falls back to the
  // parent product; resolvedPrice/resolvedCost carry the already-resolved value.
  priceOverride: string | null;
  resolvedPrice: string;
  stock: number;
  isActive: boolean;
  images: ProductImageRef[];
  values: VariantOptionValueRef[];
  createdAt: string;
  updatedAt: string;
  // SENSITIVE (CLAUDE.md rule 19): Admin + Manager only — absent entirely
  // from Employee responses.
  cost?: string | null;
  resolvedCost?: string | null;
}
