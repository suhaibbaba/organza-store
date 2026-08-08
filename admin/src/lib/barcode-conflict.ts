import { ERROR_CODES } from "@shared/constants/errors";
import { ApiError } from "@/lib/api/errors";

// A rejected barcode says what it clashed with (backend lib/barcode.ts puts the
// conflicting piece in the error's `details`). Pulled out here so the form can
// name it: "already used" without saying by what leaves the user guessing
// whether they scanned the wrong tag, or the right tag onto the wrong piece.
//
// Returns null for any other error, and for a conflict whose details didn't
// survive the trip — the plain message still explains the two ways out.
export function barcodeConflictSku(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code !== ERROR_CODES.BARCODE_DUPLICATE) return null;
  const details = error.details;
  if (typeof details !== "object" || details === null) return null;
  const sku = (details as { sku?: unknown }).sku;
  return typeof sku === "string" && sku.length > 0 ? sku : null;
}
