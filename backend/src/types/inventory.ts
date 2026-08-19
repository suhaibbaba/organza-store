export type StockItem = {
  type: "product" | "variant";
  id: string;
  productId: string;
  productName: unknown;
  variantName?: unknown;
  sku: string | null;
  barcode: string | null;
  categoryId: string | null;
  stock: number;
  // The parent product's opt-in flag (Product.trackLowStock). Carried on every
  // row — including variant rows, which inherit it — so the client can badge
  // low stock without re-deriving it from a threshold alone.
  trackLowStock: boolean;
  createdAt: Date;
};
