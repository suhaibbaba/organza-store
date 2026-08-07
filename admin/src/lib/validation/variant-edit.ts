import type { Variant } from "@shared/types/variant";
import type { UpdateVariantInput } from "@shared/schemas/product";
import { BARCODE_SOURCE } from "@shared/constants/barcode";
import { isValidBarcode, normalizeBarcode } from "@shared/lib/barcode";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import type { ProductEditAbilities, VariantEditValues } from "@/types/productForm";

export function initVariantEdits(variants: Variant[]): Record<string, VariantEditValues> {
  const map: Record<string, VariantEditValues> = {};
  for (const variant of variants) {
    map[variant.id] = {
      stock: String(variant.stock),
      priceOverride: variant.priceOverride ?? "",
      cost: variant.cost ?? "",
      isActive: variant.isActive,
      barcodeSource: variant.barcodeSource,
      // Only a supplier code is editable; ours is shown read-only from the
      // variant itself.
      barcode: variant.barcodeSource === BARCODE_SOURCE.SUPPLIER ? variant.barcode ?? "" : "",
    };
  }
  return map;
}

// Only the fields that actually changed vs. the loaded variant go into the
// PATCH body — an unchanged priceOverride/cost stays untouched rather than
// being resent (both accept `null` to explicitly clear back to the parent's
// fallback, CLAUDE.md rule 3) — and only the fields this user may write at
// all (see ProductEditAbilities; the backend gates each one).
export function diffVariantEdit(
  original: Variant,
  edits: VariantEditValues,
  abilities: ProductEditAbilities
): UpdateVariantInput | null {
  const patch: UpdateVariantInput = {};
  let changed = false;

  // Stock is an integer, never a decimal (CLAUDE.md "Mobile input" rules).
  const stock = Number(edits.stock);
  if (abilities.canEditStock && isNonNegativeIntegerString(edits.stock) && stock !== original.stock) {
    patch.stock = stock;
    changed = true;
  }

  const priceOverride = edits.priceOverride.trim() === "" ? null : edits.priceOverride.trim();
  if (abilities.canEditPrice && priceOverride !== (original.priceOverride ?? null)) {
    patch.priceOverride = priceOverride;
    changed = true;
  }

  const cost = edits.cost.trim() === "" ? null : edits.cost.trim();
  if (abilities.canEditCost && cost !== (original.cost ?? null)) {
    patch.cost = cost;
    changed = true;
  }

  if (abilities.canHide && edits.isActive !== original.isActive) {
    patch.isActive = edits.isActive;
    changed = true;
  }

  // Ours or the supplier's, per variant. Sent only when the answer (or the
  // supplier's code) actually changed: resending SUPPLIER with the same code is
  // harmless but resending GENERATED on every save would be noise in the audit
  // trail of every unrelated edit.
  const barcode = barcodeChange(original, edits);
  if (barcode) {
    Object.assign(patch, barcode);
    changed = true;
  }

  return changed ? patch : null;
}

function barcodeChange(original: Variant, edits: VariantEditValues): UpdateVariantInput | null {
  if (edits.barcodeSource === BARCODE_SOURCE.SUPPLIER) {
    const code = normalizeBarcode(edits.barcode);
    // An empty or malformed code is left out entirely rather than sent to be
    // refused — the row shows the problem inline, and the form refuses to
    // submit while one is outstanding (see the product form's onSubmit).
    if (!isValidBarcode(code)) return null;
    if (original.barcodeSource === BARCODE_SOURCE.SUPPLIER && original.barcode === code) return null;
    return { barcodeSource: BARCODE_SOURCE.SUPPLIER, barcode: code };
  }

  if (original.barcodeSource === BARCODE_SOURCE.GENERATED) return null;
  // Back to ours: the API restores the code it parked when the supplier code
  // was set, so a label already printed for this variant still scans.
  return { barcodeSource: BARCODE_SOURCE.GENERATED };
}

// Whether this row is holding a supplier code that cannot be saved — an empty
// box after the toggle was flipped, or something no scanner could have
// produced. The form asks before it submits, so nothing is silently dropped.
export function variantBarcodeIncomplete(edits: VariantEditValues): boolean {
  return edits.barcodeSource === BARCODE_SOURCE.SUPPLIER && !isValidBarcode(normalizeBarcode(edits.barcode));
}
