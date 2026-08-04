// Helpers for the Orders suite: a throwaway product to sell, and a way to
// read back the stock the API currently reports for it.
import { apiRequest, uniqueId } from "@tests/support/client";
import { anyCategoryId } from "@tests/support/fixtures";
import type { ProductDto } from "@tests/types";

export interface SellableProduct {
  id: string;
  stock: number;
  basePrice: string;
}

// A simple (variant-less) product with a known price, cost and stock, so
// every stock and money assertion in the suite starts from a fixed point
// instead of from whatever the seed happens to hold.
export async function createSellableProduct(
  token: string,
  options: { basePrice?: string; cost?: string; stock?: number } = {}
): Promise<SellableProduct> {
  const nonce = uniqueId();
  const categoryId = await anyCategoryId(token);
  const basePrice = options.basePrice ?? "100";
  const stock = options.stock ?? 10;

  const res = await apiRequest<ProductDto>("/api/products", {
    method: "POST",
    token,
    body: {
      name: { ar: `طلبية ${nonce}`, en: `Vitest Order Product ${nonce}` },
      categoryId,
      basePrice,
      cost: options.cost ?? "40",
      stock: String(stock),
    },
  });
  if (res.status !== 201 || !res.data) {
    throw new Error(`Could not create a sellable product for the Orders suite (HTTP ${res.status}).`);
  }
  return { id: res.data.id, stock, basePrice };
}

export async function readStock(token: string, productId: string): Promise<number> {
  const res = await apiRequest<ProductDto>(`/api/products/${productId}`, { token });
  if (res.status !== 200 || res.data?.stock === undefined) {
    throw new Error(`Could not read stock for product ${productId} (HTTP ${res.status}).`);
  }
  return res.data.stock;
}
