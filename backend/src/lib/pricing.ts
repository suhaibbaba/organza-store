import { Role } from "@prisma/client";
import type { AnyRecord } from "@/types";

// `cost` is sensitive (CLAUDE.md rule 19): Admin + Manager only, never
// returned to Employees. Enforced here, at the response boundary, not just
// hidden in a UI.
function canSeeCost(role: Role): boolean {
  return role === Role.ADMIN || role === Role.MANAGER;
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
    priceOverride: variant.priceOverride,
    resolvedPrice,
    stock: variant.stock,
    isActive: variant.isActive,
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
    stock: variants.length ? undefined : product.stock,
    isActive: product.isActive,
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
    stock: aggregateStock,
    isActive: product.isActive,
    hasVariants: variants.length > 0,
    variantCount: variants.length,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };

  if (canSeeCost(role)) {
    dto.cost = product.cost;
  }

  return dto;
}
