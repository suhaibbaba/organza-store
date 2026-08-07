import type { StockStatus } from "@/types/inventory";

interface ResolveStockStatusInput {
  stock: number;
  // The parent product's opt-in flag (Product.trackLowStock). Variants
  // inherit it from their product — a variant has no flag of its own.
  trackLowStock: boolean;
  // Setting.lowStockThreshold (CLAUDE.md rule 14 — read it, never assume it).
  threshold: number;
}

// The one place that decides whether a quantity is gone, nearly gone, or fine.
//
// It exists because the answer is not "stock <= 3": low stock is opt-in per
// product (Product.trackLowStock), since almost every piece in this shop is a
// one-off sitting at stock = 1 and amber-badging all of them would bury the
// products that genuinely need restocking. That rule was already written out
// by hand in the admin's inventory table and again in its card; the POS is
// now colour-coding stock too, and a fourth and fifth copy of an if-statement
// is how a quantity ends up amber on one screen and plain on another.
//
// Out of stock is never opt-in: nothing left is nothing left, whether or not
// anybody asked to be warned about it.
export function resolveStockStatus({ stock, trackLowStock, threshold }: ResolveStockStatusInput): StockStatus {
  if (stock <= 0) return "OUT";
  if (trackLowStock && stock <= threshold) return "LOW";
  return "IN";
}
