import type { StockStatus } from "@/types/inventory";

interface ResolveStockStatusInput {
  stock: number;
  // Product.trackLowStock; variants inherit it.
  trackLowStock: boolean;
  // Setting.lowStockThreshold (CLAUDE.md rule 14 — read it, never assume it).
  threshold: number;
}

// The one stock-level decision: low stock is opt-in per product (most pieces are one-offs at 1), out of stock never is.
export function resolveStockStatus({ stock, trackLowStock, threshold }: ResolveStockStatusInput): StockStatus {
  if (stock <= 0) {
    return "OUT";
  }
  if (trackLowStock && stock <= threshold) {
    return "LOW";
  }
  return "IN";
}
