import { NUMBER_VARIANT_TYPE_SLUG } from "@store/shared/constants/variantType";
import type { Product } from "@store/shared/types/product";
import type { Variant } from "@store/shared/types/variant";

// Only consulted on a product already flagged numbered: it locates the number, it decides nothing.
export function numberVariantTypeId(product: Product): string | null {
  return product.variantTypes.find((type) => type.slug === NUMBER_VARIANT_TYPE_SLUG)?.id ?? null;
}

// The product's explicit flag, as in the admin, never a guess from its variant types.
export function isNumberedProduct(product: Product): boolean {
  return product.isNumbered;
}

// From the option value's stable key, never its translation (rule 9).
export function variantNumber(variant: Variant, numberTypeId: string): string | null {
  return variant.values.find((value) => value.variantTypeId === numberTypeId)?.key ?? null;
}

// Usually one, but a product pairing numbers with a colour legitimately returns several.
export function variantsByNumber(product: Product, typed: string): Variant[] {
  const numberTypeId = numberVariantTypeId(product);
  if (!numberTypeId) {
    return [];
  }
  const wanted = typed.trim();
  if (!wanted) {
    return [];
  }
  return product.variants.filter((variant) => variantNumber(variant, numberTypeId) === wanted);
}

// Otherwise the picker shows the plain thumbnail.
export function hasPlacedNumbers(product: Product): boolean {
  return (
    product.isNumbered &&
    product.images.length > 0 &&
    product.variants.some((variant) => variant.imageX != null && variant.imageY != null)
  );
}
