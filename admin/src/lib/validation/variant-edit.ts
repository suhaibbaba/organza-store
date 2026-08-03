import type { Variant } from "@shared/types/variant";
import type { UpdateVariantInput } from "@shared/schemas/product";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import type { VariantEditValues } from "@/types/productForm";

export function initVariantEdits(variants: Variant[]): Record<string, VariantEditValues> {
  const map: Record<string, VariantEditValues> = {};
  for (const variant of variants) {
    map[variant.id] = {
      stock: String(variant.stock),
      priceOverride: variant.priceOverride ?? "",
      cost: variant.cost ?? "",
      isActive: variant.isActive,
    };
  }
  return map;
}

// Only the fields that actually changed vs. the loaded variant go into the
// PATCH body — an unchanged priceOverride/cost stays untouched rather than
// being resent (both accept `null` to explicitly clear back to the parent's
// fallback, CLAUDE.md rule 3).
export function diffVariantEdit(original: Variant, edits: VariantEditValues): UpdateVariantInput | null {
  const patch: UpdateVariantInput = {};
  let changed = false;

  // Stock is an integer, never a decimal (CLAUDE.md "Mobile input" rules).
  const stock = Number(edits.stock);
  if (isNonNegativeIntegerString(edits.stock) && stock !== original.stock) {
    patch.stock = stock;
    changed = true;
  }

  const priceOverride = edits.priceOverride.trim() === "" ? null : edits.priceOverride.trim();
  if (priceOverride !== (original.priceOverride ?? null)) {
    patch.priceOverride = priceOverride;
    changed = true;
  }

  const cost = edits.cost.trim() === "" ? null : edits.cost.trim();
  if (cost !== (original.cost ?? null)) {
    patch.cost = cost;
    changed = true;
  }

  if (edits.isActive !== original.isActive) {
    patch.isActive = edits.isActive;
    changed = true;
  }

  return changed ? patch : null;
}
