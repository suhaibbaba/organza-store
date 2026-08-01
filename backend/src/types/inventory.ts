export type StockItem = {
  type: "product" | "variant";
  id: string;
  productId: string;
  productName: unknown;
  variantName?: unknown;
  sku: string | null;
  barcode: string | null;
  categoryId: string;
  stock: number;
  createdAt: Date;
};
