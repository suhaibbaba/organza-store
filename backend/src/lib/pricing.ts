import { Role } from "@prisma/client";
import { can } from "@organza/shared/lib/permissions";
import { needsLabel } from "@/lib/labelState";
import { summarizeNumbers } from "@/lib/numberedProduct";
import type { AnyRecord } from "@/types";

// `cost` is sensitive (CLAUDE.md rule 19): ADMIN ONLY — never returned to a
// Manager or an Employee. Enforced here, at the response boundary, not just
// hidden in a UI.
function canSeeCost(role: Role): boolean {
  return can({ role }, "product.viewCost");
}

function serializeImage(image: AnyRecord) {
  return {
    id: image.id,
    url: image.url,
    mediumUrl: image.mediumUrl,
    thumbnailUrl: image.thumbnailUrl,
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary,
  };
}

export function serializeVariant(variant: AnyRecord, product: AnyRecord, role: Role) {
  const resolvedPrice = variant.priceOverride ?? product.basePrice;
  const resolvedCost = variant.cost ?? product.cost ?? null;
  // Fallback rule: a variant with no images of its own uses the parent
  // product's gallery, resolved at read time (never copied).
  const images: AnyRecord[] = variant.images?.length ? variant.images : product.images ?? [];

  const dto: AnyRecord = {
    id: variant.id,
    variantNumber: variant.variantNumber,
    name: variant.name,
    sku: variant.sku,
    barcode: variant.barcode,
    // Ours or the supplier's (shared/constants/barcode.ts). Not sensitive —
    // it is what a screen needs to say whether this variant still owes a
    // label, and what the barcode field in the form opens on.
    barcodeSource: variant.barcodeSource,
    priceOverride: variant.priceOverride,
    resolvedPrice,
    stock: variant.stock,
    isActive: variant.isActive,
    imageX: variant.imageX,
    imageY: variant.imageY,
    images: images.map(serializeImage),
    values: (variant.values ?? []).map((vv: AnyRecord) => ({
      id: vv.optionValue.id,
      variantTypeId: vv.optionValue.variantTypeId,
      value: vv.optionValue.value,
      key: vv.optionValue.key,
    })),
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt,
  };

  if (canSeeCost(role)) {
    dto.cost = variant.cost;
    dto.resolvedCost = resolvedCost;
  }

  return dto;
}

// Full detail DTO (single product), including all variants resolved.
export function serializeProduct(product: AnyRecord, role: Role) {
  const variants = product.variants ?? [];

  const dto: AnyRecord = {
    id: product.id,
    productNumber: product.productNumber,
    name: product.name,
    slug: product.slug,
    description: product.description,
    category: product.category
      ? { id: product.category.id, name: product.category.name, slug: product.category.slug }
      : null,
    basePrice: product.basePrice,
    compareAtPrice: product.compareAtPrice,
    sku: product.sku,
    barcode: product.barcode,
    barcodeSource: product.barcodeSource,
    stock: variants.length ? undefined : product.stock,
    isActive: product.isActive,
    trackLowStock: product.trackLowStock,
    // The product's own explicit "this sells numbers, nothing else" choice
    // (spec.md "Numbered shawls") — what every screen branches on.
    isNumbered: product.isNumbered ?? false,
    labelsPrintedAt: product.labelsPrintedAt ?? null,
    deletedAt: product.deletedAt,
    hasVariants: variants.length > 0,
    images: (product.images ?? []).map(serializeImage),
    variantTypes: (product.variantTypes ?? []).map((pvt: AnyRecord) => ({
      id: pvt.variantType.id,
      name: pvt.variantType.name,
      slug: pvt.variantType.slug,
    })),
    variants: variants.map((v: AnyRecord) => serializeVariant(v, product, role)),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };

  if (canSeeCost(role)) {
    dto.cost = product.cost;
  }

  return dto;
}

// Lighter DTO for list endpoints — no per-variant breakdown, just enough to
// render a row (aggregate stock, variant count).
export function serializeProductSummary(product: AnyRecord, role: Role) {
  const variants = product.variants ?? [];
  const aggregateStock = variants.length
    ? variants.reduce((sum: number, v: AnyRecord) => sum + v.stock, 0)
    : product.stock;
  const { isNumbered, numberCount } = summarizeNumbers(product);

  const dto: AnyRecord = {
    id: product.id,
    productNumber: product.productNumber,
    name: product.name,
    slug: product.slug,
    category: product.category
      ? { id: product.category.id, name: product.category.name, slug: product.category.slug }
      : null,
    basePrice: product.basePrice,
    compareAtPrice: product.compareAtPrice,
    sku: product.sku,
    barcode: product.barcode,
    barcodeSource: product.barcodeSource,
    stock: aggregateStock,
    isActive: product.isActive,
    trackLowStock: product.trackLowStock,
    labelsPrintedAt: product.labelsPrintedAt ?? null,
    // Whether a label is still owed at all, which the list row cannot work
    // out for itself: it depends on the variants' own barcode sources, and a
    // summary carries no variants. Same rule as the "not printed yet" filter
    // (lib/labelState.ts).
    needsLabel: needsLabel(product),
    hasVariants: variants.length > 0,
    variantCount: variants.length,
    // What kind of choice this product asks for — "sizes", "colours" — so a
    // list can say so without fetching each product's detail. The POS search
    // reads it to tell a card that opens a picker apart from one that adds
    // straight to the cart. Already loaded by the list query's include (it is
    // what summarizeNumbers counts against), so this costs nothing extra.
    variantTypes: (product.variantTypes ?? []).map((pvt: AnyRecord) => ({
      id: pvt.variantType.id,
      name: pvt.variantType.name,
      slug: pvt.variantType.slug,
    })),
    isNumbered,
    numberCount,
    // Lowest sortOrder = primary (spec.md); already loaded by the list
    // query's include, so this costs nothing extra.
    image: product.images?.length ? serializeImage(product.images[0]) : null,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };

  if (canSeeCost(role)) {
    dto.cost = product.cost;
  }

  return dto;
}
