import { Role } from "@prisma/client";
import { can } from "@store/shared/lib/permissions";
import { needsLabel } from "@/lib/labelState";
import { needsCompleting } from "@/lib/quickSellState";
import { summarizeNumbers } from "@/lib/numberedProduct";
import { serializeMarkedImage } from "@/lib/markedImage";
import { VARIANT_IMAGE_PREVIEW_LIMIT } from "@store/shared/constants/product";
import type { AnyRecord } from "@/types";

// `cost` is Admin only (rule 19), enforced here at the response boundary.
function canSeeCost(role: Role): boolean {
  return can({ role }, "product.viewCost");
}

function serializeImage(image: AnyRecord) {
  return {
    id: image.id,
    url: image.url,
    mediumUrl: image.mediumUrl,
    thumbnailUrl: image.thumbnailUrl,
    // Re-crop source and last crop; null on pre-editor photos, so re-framing is offered only where possible.
    originalUrl: image.originalUrl ?? null,
    edit: image.edit ?? null,
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary,
    // Photo brightness 0-100 (null if never measured), read by numbered-shawl markers to suggest their colour.
    brightness: image.brightness ?? null,
  };
}

// Option-value notes as a lookup, built once per product and shared by every variant.
function noteByOptionValueId(product: AnyRecord): Map<string, AnyRecord> {
  return new Map(
    ((product.optionValueNotes ?? []) as AnyRecord[]).map((row) => [row.optionValueId as string, row.note]),
  );
}

export function serializeVariant(variant: AnyRecord, product: AnyRecord, role: Role) {
  const resolvedPrice = variant.priceOverride ?? product.basePrice;
  const resolvedCost = variant.cost ?? product.cost ?? null;
  // A variant with no images uses the parent's gallery, resolved at read time.
  const images: AnyRecord[] = variant.images?.length ? variant.images : (product.images ?? []);

  const notes = noteByOptionValueId(product);

  const dto: AnyRecord = {
    id: variant.id,
    variantNumber: variant.variantNumber,
    name: variant.name,
    sku: variant.sku,
    barcode: variant.barcode,
    // Ours or the supplier's — tells a screen whether the variant still owes a label.
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
      // What this value means on this product, travelling with the value reference; usually null.
      note: notes.get(vv.optionValue.id) ?? null,
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
    // The product's explicit numbered-shawl choice — what every screen branches on.
    isNumbered: product.isNumbered ?? false,
    // One marker colour pair for all numbers; null means follow the photo's brightness (resolvePointColors on the client).
    pointTextColor: product.pointTextColor ?? null,
    pointBackgroundColor: product.pointBackgroundColor ?? null,
    labelsPrintedAt: product.labelsPrintedAt ?? null,
    // Quick sell facts; every screen reads `needsCompleting` rather than re-deriving the rule.
    quickSoldAt: product.quickSoldAt ?? null,
    completedAt: product.completedAt ?? null,
    oneOffAt: product.oneOffAt ?? null,
    needsCompleting: needsCompleting(product),
    deletedAt: product.deletedAt,
    hasVariants: variants.length > 0,
    // The variants' value notes, flat, for the product form, which needs them before any variant exists.
    optionValueNotes: ((product.optionValueNotes ?? []) as AnyRecord[]).map((row) => ({
      optionValueId: row.optionValueId,
      note: row.note,
    })),
    images: (product.images ?? []).map(serializeImage),
    markedImage: serializeMarkedImage(product.markedImage),
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

// Lighter DTO for list endpoints: enough to draw a row, no per-variant breakdown.
export function serializeProductSummary(product: AnyRecord, role: Role) {
  const variants = product.variants ?? [];
  const aggregateStock = variants.length
    ? variants.reduce((sum: number, v: AnyRecord) => sum + v.stock, 0)
    : product.stock;
  const { isNumbered, numberCount } = summarizeNumbers(product);
  const primary: AnyRecord | undefined = product.images?.[0];

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
    // Quick sell (spec.md): every screen reads needsCompleting rather than re-deriving the rule.
    quickSoldAt: product.quickSoldAt ?? null,
    completedAt: product.completedAt ?? null,
    oneOffAt: product.oneOffAt ?? null,
    needsCompleting: needsCompleting(product),
    // Depends on the variants' own barcode sources, which a summary does not carry (lib/labelState.ts).
    needsLabel: needsLabel(product),
    hasVariants: variants.length > 0,
    variantCount: variants.length,
    // "sizes", "colours": lets a list (and the POS) say what a picker will ask for.
    variantTypes: (product.variantTypes ?? []).map((pvt: AnyRecord) => ({
      id: pvt.variantType.id,
      name: pvt.variantType.name,
      slug: pvt.variantType.slug,
    })),
    isNumbered,
    numberCount,
    // Lowest sortOrder = primary (spec.md).
    image: primary ? serializeImage(primary) : null,
    // Numbered shawls show their numbers on the photo everywhere, burned in by lib/markedImage.ts.
    markedImage: serializeMarkedImage(product.markedImage),
    variantImages: variantPreviewImages(product, primary),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };

  if (canSeeCost(role)) {
    dto.cost = product.cost;
  }

  return dto;
}

// Each variant's own main photo when it differs from the product's, so a list shows what the piece comes in.
function variantPreviewImages(product: AnyRecord, primary: AnyRecord | undefined) {
  const seen = new Set<string>(primary ? [primary.id] : []);
  const images: AnyRecord[] = [];
  for (const variant of (product.variants ?? []) as AnyRecord[]) {
    const own = variant.images?.[0];
    if (!own || seen.has(own.id)) {
      continue;
    }
    seen.add(own.id);
    images.push(serializeImage(own));
    if (images.length === VARIANT_IMAGE_PREVIEW_LIMIT) {
      break;
    }
  }
  return images;
}
