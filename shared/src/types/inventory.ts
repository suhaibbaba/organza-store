import type { I18n } from "@/types/common";
import type { ChangeRequest } from "@/types/changeRequest";

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
  // The parent product's opt-in flag (Product.trackLowStock). Variant rows
  // inherit it from their product. A row with this false must never be shown
  // as low stock, however small its quantity.
  trackLowStock: boolean;
  // Stock changes somebody has asked for on this exact row but may not make
  // (spec.md "Employee change approvals"). Empty for almost every row; when
  // it isn't, the quantity shown is spoken for rather than simply wrong.
  pendingChanges?: ChangeRequest[];
  createdAt: string;
}

export interface StockAdjustResult {
  id: string;
  stock: number;
}
