import type { I18n } from "@/types/common";
import type { CategoryRef } from "@/types/category";
import type { ProductImageRef, Variant } from "@/types/variant";
import type { PRODUCT_LOOKUP_KINDS, PRODUCT_PRINT_STATES } from "@/constants/product";

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
  // Numbered product (spec.md "Numbered shawls"): one photo carrying numbers,
  // each number a piece of its own. An explicit choice made when the product
  // is added, never inferred from which variant types it happens to use — it
  // decides what the rest of the product form shows, and which variant types
  // the API accepts (numbers only when true, never when false).
  isNumbered: boolean;
  // When this product's barcode labels were last printed (CLAUDE.md rule 13).
  // Null means never printed; reprinting simply moves the timestamp forward,
  // it is never a lock.
  labelsPrintedAt: string | null;
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
  // Null until this product's labels have been printed at least once — what
  // the "not printed yet" list filter keys off.
  labelsPrintedAt: string | null;
  hasVariants: boolean;
  variantCount: number;
  // Which kinds of choice this product's variants are made of ("sizes",
  // "colours"), empty for a simple product. Enough to say what a picker will
  // ask for without loading every variant — CLAUDE.md rule 2 means these are
  // references, so a renamed type shows through here on its own.
  variantTypes: ProductVariantTypeRef[];
  // Numbered products (spec.md "Numbered shawls"): the numbers themselves are
  // illegible on a list thumbnail, so the list UI labels the product type with
  // a badge instead. `isNumbered` is the product's own explicit flag;
  // `numberCount` is how many distinct numbers it offers.
  isNumbered: boolean;
  numberCount: number;
  image: ProductImageRef | null;
  createdAt: string;
  updatedAt: string;
  cost?: string | null;
}

export type ProductPrintState = (typeof PRODUCT_PRINT_STATES)[number];
export type ProductLookupKind = (typeof PRODUCT_LOOKUP_KINDS)[number];

// One number of a numbered shawl (spec.md "Numbered shawls") as the POS needs
// it to ask "which one?": the number as drawn on the image, what is left of
// it, and the variant id that has to be named to sell it.
export interface ProductNumberOption {
  // The variant behind this number — an order line MUST carry it; a sale on
  // the parent alone is refused (error.order.variant_required).
  variantId: string;
  variantNumber: number;
  // The variant's own label, e.g. "1" or "1 / أحمر" when the product also
  // has colours.
  name: I18n;
  // The Number option value itself (CLAUDE.md rule 2: referenced, never
  // copied — renaming it upstream shows through here).
  number: I18n;
  numberKey: string;
  sku: string;
  barcode: string | null;
  resolvedPrice: string;
  stock: number;
  // False for a number that cannot be sold right now — nothing left in
  // stock, or the variant is hidden. The POS greys these out rather than
  // hiding them, so the cashier can see the number exists and is gone.
  available: boolean;
  // Where the number sits on the product image, percentage 0-100.
  imageX: number | null;
  imageY: number | null;
}

// GET /api/products/lookup?code=… — what a POS scan resolves to.
//
// kind ITEM: `variant` is the exact variant whose barcode/SKU matched, or
// null when the code belonged to a simple product, which is itself the
// purchasable item. `numbers` is empty.
//
// kind NUMBER_SELECTION: the code was a numbered shawl's parent label. There
// is nothing sellable to return — `variant` is null — and `numbers` carries
// every number with its stock so the cashier picks one.
export interface ProductLookupResult {
  kind: ProductLookupKind;
  product: Product;
  variant: Variant | null;
  numbers: ProductNumberOption[];
}

// POST /api/products/labels/printed — the products whose labels were just
// sent to the printer, and the timestamp now stamped on all of them.
export interface MarkLabelsPrintedResult {
  productIds: string[];
  labelsPrintedAt: string;
}
