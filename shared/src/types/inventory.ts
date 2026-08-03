import type { I18n } from "@/types/common";

// Flattened stock row returned by GET /api/inventory (backend/src/routes/inventory.ts):
// one row per simple product, or per variant when the product has variants.
export interface InventoryItem {
  type: "product" | "variant";
  id: string;
  productId: string;
  productName: I18n;
  variantName?: I18n;
  sku: string | null;
  barcode: string | null;
  categoryId: string;
  stock: number;
  createdAt: string;
}

export interface StockAdjustResult {
  id: string;
  stock: number;
}
