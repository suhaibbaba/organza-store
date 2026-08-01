// PATCH /api/inventory/products/:id and /variants/:id both respond with this
// small shape (backend/src/routes/inventory.ts), distinct from the GET list's
// StockItem (@/types) which is reused as-is where it applies.
export interface StockAdjustResult {
  id: string;
  stock: number;
}
