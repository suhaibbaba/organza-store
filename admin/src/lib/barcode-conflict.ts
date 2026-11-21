import { ERROR_CODES } from "@store/shared/constants/errors";
import { ApiError } from "@/lib/api/errors";

// Names what the barcode clashed with (from the error's details); null when unknown.
export function barcodeConflictSku(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code !== ERROR_CODES.BARCODE_DUPLICATE) {
    return null;
  }
  const details = error.details;
  if (typeof details !== "object" || details === null) {
    return null;
  }
  const sku = (details as { sku?: unknown }).sku;
  return typeof sku === "string" && sku.length > 0 ? sku : null;
}
