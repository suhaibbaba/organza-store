import { NUMBER_VARIANT_TYPE_SLUG } from "@shared/constants/variantType";
import type { Product } from "@shared/types/product";
import type { Variant } from "@shared/types/variant";

// Which variant type carries the numbers, so a variant's number can be read
// off it below. Only ever consulted on a product that already says it is
// numbered — this locates the number, it does not decide anything.
export function numberVariantTypeId(product: Product): string | null {
  return product.variantTypes.find((type) => type.slug === NUMBER_VARIANT_TYPE_SLUG)?.id ?? null;
}

// Numbered shawls (spec.md) say so themselves: the POS reads the product's
// own explicit flag, exactly like the admin does, rather than guessing from
// the variant types it happens to use.
export function isNumberedProduct(product: Product): boolean {
  return product.isNumbered;
}

// The number a variant carries, as printed on the shared photo. Taken from
// the option value's stable `key` rather than its translated text
// (CLAUDE.md rule 9: identity never depends on a translation) — digits read
// the same in all three languages, but the key is what the value is really
// filed under.
export function variantNumber(variant: Variant, numberTypeId: string): string | null {
  return variant.values.find((value) => value.variantTypeId === numberTypeId)?.key ?? null;
}

// Every variant whose number matches what the cashier typed. Usually exactly
// one — a numbered shawl offers nothing but numbers (spec.md deliberately
// omits sizes/colours for them) — but a product that pairs numbers with, say,
// a colour would legitimately return several, and the picker then narrows
// to those rather than guessing one.
export function variantsByNumber(product: Product, typed: string): Variant[] {
  const numberTypeId = numberVariantTypeId(product);
  if (!numberTypeId) return [];
  const wanted = typed.trim();
  if (!wanted) return [];
  return product.variants.filter((variant) => variantNumber(variant, numberTypeId) === wanted);
}
