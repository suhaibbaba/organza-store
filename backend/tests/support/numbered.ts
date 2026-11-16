// Helpers for the numbered-shawl suite: a product that declares itself
// numbered (isNumbered — spec.md "Numbered shawls"; the kind is an explicit
// choice, never inferred from the variant types it uses) and is built on the
// global Number variant type, with the stock of each number set to a known
// figure so every assertion starts from a fixed point.
import { apiRequest, uniqueId } from "@tests/support/client";
import { anyCategoryId, firstTwoNumberValueIds } from "@tests/support/fixtures";
import type { ProductDto } from "@tests/types";

export interface NumberedShawl {
  product: ProductDto;
  // The two numbers, in variantNumber order.
  numbers: ProductDto["variants"];
}

// `stocks` is applied to the numbers in order — pass a 0 to model a number
// that is sold out (it must still be listed, just flagged unavailable).
export async function createNumberedShawl(
  adminToken: string,
  options: { basePrice?: string; stocks?: [number, number] } = {}
): Promise<NumberedShawl> {
  const nonce = uniqueId();
  const categoryId = await anyCategoryId(adminToken);
  const { variantTypeId, valueIds } = await firstTwoNumberValueIds(adminToken);
  const name = `Vitest Numbered ${nonce}`;

  const created = await apiRequest<ProductDto>("/api/products", {
    method: "POST",
    token: adminToken,
    body: {
      name: { ar: name, en: name },
      categoryId,
      basePrice: options.basePrice ?? "60",
      isNumbered: true,
      optionSelections: [{ variantTypeId, valueIds }],
    },
  });
  if (created.status !== 201 || !created.data) {
    throw new Error(`Could not create a numbered shawl for the tests (HTTP ${created.status}).`);
  }

  const stocks = options.stocks ?? [3, 0];
  for (const [index, variant] of created.data.variants.entries()) {
    const res = await apiRequest(`/api/products/${created.data.id}/variants/${variant.id}`, {
      method: "PATCH",
      token: adminToken,
      body: { stock: String(stocks[index] ?? 1) },
    });
    if (res.status !== 200) {
      throw new Error(`Could not set the stock of number ${index + 1} (HTTP ${res.status}).`);
    }
  }

  const reloaded = await apiRequest<ProductDto>(`/api/products/${created.data.id}`, { token: adminToken });
  if (reloaded.status !== 200 || !reloaded.data) {
    throw new Error(`Could not reload the numbered shawl (HTTP ${reloaded.status}).`);
  }
  return { product: reloaded.data, numbers: reloaded.data.variants };
}
