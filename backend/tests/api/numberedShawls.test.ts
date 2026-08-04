// Numbered shawls at the counter (spec.md "Numbered shawls"): one photo,
// numbers drawn on it, each number its own piece with its own stock. The
// parent's label therefore stands for the whole collection — scanning it must
// never hand the POS something sellable, or a sale would deduct stock from the
// wrong place.
import { afterAll, describe, expect, it } from "vitest";
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { createNumberedShawl } from "@tests/support/numbered";
import type { ProductDto, ProductLookupDto } from "@tests/types";
import { ERROR_CODES, PRODUCT_LOOKUP_KIND } from "@/constants";

async function readVariantStock(token: string, productId: string, variantId: string): Promise<number> {
  const res = await apiRequest<ProductDto>(`/api/products/${productId}`, { token });
  const variant = res.data?.variants.find((v) => v.id === variantId);
  if (!variant || variant.stock === undefined) {
    throw new Error(`Could not read the stock of variant ${variantId} (HTTP ${res.status}).`);
  }
  return variant.stock;
}

describe("Numbered shawls", () => {
  const createdProductIds: string[] = [];

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    for (const id of createdProductIds) {
      await apiRequest(`/api/products/${id}`, { method: "DELETE", token: admin.token });
    }
  });

  it("answers a scan of the parent label with the list of numbers, not a sellable item", async () => {
    const admin = await getSession("ADMIN");
    const employee = await getSession("EMPLOYEE");
    // Number 2 is sold out — it must still be listed, just flagged.
    const { product, numbers } = await createNumberedShawl(admin.token, { basePrice: "60", stocks: [3, 0] });
    createdProductIds.push(product.id);

    const res = await apiRequest<ProductLookupDto>(
      `/api/products/lookup?code=${encodeURIComponent(product.barcode!)}`,
      { token: employee.token }
    );

    expect(res.status).toBe(200);
    expect(res.data!.kind).toBe(PRODUCT_LOOKUP_KIND.NUMBER_SELECTION);
    // Nothing sellable: the cashier has to pick a number first.
    expect(res.data!.variant).toBeNull();
    expect(res.data!.product.id).toBe(product.id);

    const options = res.data!.numbers;
    expect(options).toHaveLength(numbers.length);
    expect(options.map((o) => o.variantId)).toEqual(numbers.map((v) => v.id));

    // Each entry carries what the POS needs to render the choice: the number
    // itself (referenced from the global option value, CLAUDE.md rule 2), the
    // price it sells at, and what is left of it.
    expect(options[0].stock).toBe(3);
    expect(options[0].available).toBe(true);
    expect(Number(options[0].resolvedPrice)).toBe(60);
    expect(options[0].numberKey.length).toBeGreaterThan(0);
    expect(options[0].number.ar.length).toBeGreaterThan(0);

    // A number with nothing left is listed and flagged, never dropped — the
    // cashier needs to see that it exists and is gone.
    expect(options[1].stock).toBe(0);
    expect(options[1].available).toBe(false);
  });

  it("still resolves one number's own barcode straight to that variant", async () => {
    const admin = await getSession("ADMIN");
    const { product, numbers } = await createNumberedShawl(admin.token, { stocks: [2, 2] });
    createdProductIds.push(product.id);

    const target = numbers[1];
    const res = await apiRequest<ProductLookupDto>(
      `/api/products/lookup?code=${encodeURIComponent(target.barcode!)}`,
      { token: admin.token }
    );

    expect(res.status).toBe(200);
    // A number scanned on its own label IS one piece — no choice to make.
    expect(res.data!.kind).toBe(PRODUCT_LOOKUP_KIND.ITEM);
    expect(res.data!.variant?.id).toBe(target.id);
    expect(res.data!.numbers).toEqual([]);
  });

  it("refuses a sale of the parent without a number, and moves no stock", async () => {
    const admin = await getSession("ADMIN");
    const employee = await getSession("EMPLOYEE");
    const { product, numbers } = await createNumberedShawl(admin.token, { stocks: [3, 3] });
    createdProductIds.push(product.id);

    const res = await apiRequest("/api/orders", {
      method: "POST",
      token: employee.token,
      body: { channel: "STORE", items: [{ productId: product.id, quantity: 1 }] },
    });

    expect(res.status).toBe(400);
    expect(res.error?.code).toBe(ERROR_CODES.ORDER_VARIANT_REQUIRED);

    // The refusal has to be total: no line, no deduction anywhere.
    expect(await readVariantStock(admin.token, product.id, numbers[0].id)).toBe(3);
    expect(await readVariantStock(admin.token, product.id, numbers[1].id)).toBe(3);
  });

  it("deducts the chosen number's stock and leaves the other numbers alone", async () => {
    const admin = await getSession("ADMIN");
    const employee = await getSession("EMPLOYEE");
    const { product, numbers } = await createNumberedShawl(admin.token, { stocks: [3, 3] });
    createdProductIds.push(product.id);

    const chosen = numbers[0];
    const untouched = numbers[1];

    const order = await apiRequest("/api/orders", {
      method: "POST",
      token: employee.token,
      body: {
        channel: "STORE",
        items: [{ productId: product.id, variantId: chosen.id, quantity: 2 }],
      },
    });
    expect(order.status).toBe(201);

    // A counter sale deducts immediately, and only from the number that was
    // actually picked.
    expect(await readVariantStock(admin.token, product.id, chosen.id)).toBe(1);
    expect(await readVariantStock(admin.token, product.id, untouched.id)).toBe(3);
  });
});
