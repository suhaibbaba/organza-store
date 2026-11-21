import type { Variant } from "@store/shared/types/variant";
import type { UpdateVariantInput } from "@store/shared/schemas/product";
import { BARCODE_SOURCE } from "@store/shared/constants/barcode";
import { isValidBarcode, normalizeBarcode } from "@store/shared/lib/barcode";
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
      barcode: variant.barcodeSource === BARCODE_SOURCE.SUPPLIER ? (variant.barcode ?? "") : "",
    };
  }
  return map;
}

// Only fields the user changed and may write; untouched ones are left out even if the variant has since moved on.
export function diffVariantEdit(
  original: Variant,
  edits: VariantEditValues,
  abilities: ProductEditAbilities,
  baseline?: VariantEditValues,
): UpdateVariantInput | null {
  const patch: UpdateVariantInput = {};
  let changed = false;
  const touched = (field: keyof VariantEditValues) => !baseline || edits[field] !== baseline[field];

  // Stock is an integer, never a decimal (CLAUDE.md "Mobile input" rules).
  const stock = Number(edits.stock);
  if (
    abilities.canEditStock &&
    touched("stock") &&
    isNonNegativeIntegerString(edits.stock) &&
    stock !== original.stock
  ) {
    patch.stock = stock;
    changed = true;
  }

  const priceOverride = edits.priceOverride.trim() === "" ? null : edits.priceOverride.trim();
  if (abilities.canEditPrice && touched("priceOverride") && priceOverride !== (original.priceOverride ?? null)) {
    patch.priceOverride = priceOverride;
    changed = true;
  }

  const cost = edits.cost.trim() === "" ? null : edits.cost.trim();
  if (abilities.canEditCost && touched("cost") && cost !== (original.cost ?? null)) {
    patch.cost = cost;
    changed = true;
  }

  if (abilities.canHide && touched("isActive") && edits.isActive !== original.isActive) {
    patch.isActive = edits.isActive;
    changed = true;
  }

  // Only when it changed, or every unrelated edit would add GENERATED to the audit trail.
  const barcode = touched("barcodeSource") || touched("barcode") ? barcodeChange(original, edits) : null;
  if (barcode) {
    Object.assign(patch, barcode);
    changed = true;
  }

  return changed ? patch : null;
}

function barcodeChange(original: Variant, edits: VariantEditValues): UpdateVariantInput | null {
  if (edits.barcodeSource === BARCODE_SOURCE.SUPPLIER) {
    const code = normalizeBarcode(edits.barcode);
    // Left out rather than sent to be refused; the row shows the problem and submit is blocked.
    if (!isValidBarcode(code)) {
      return null;
    }
    if (original.barcodeSource === BARCODE_SOURCE.SUPPLIER && original.barcode === code) {
      return null;
    }
    return { barcodeSource: BARCODE_SOURCE.SUPPLIER, barcode: code };
  }

  if (original.barcodeSource === BARCODE_SOURCE.GENERATED) {
    return null;
  }
  // The API restores our parked code, so a label already printed still scans.
  return { barcodeSource: BARCODE_SOURCE.GENERATED };
}

// An empty or impossible supplier code; the form asks before submitting.
export function variantBarcodeIncomplete(edits: VariantEditValues): boolean {
  return edits.barcodeSource === BARCODE_SOURCE.SUPPLIER && !isValidBarcode(normalizeBarcode(edits.barcode));
}
