// Numbered shawls at the counter (spec.md "Numbered shawls"): one photo,
// numbers drawn on it, each number its own piece with its own stock. The
// parent's label therefore stands for the whole collection — scanning it must
// never hand the POS something sellable, or a sale would deduct stock from the
// wrong place.
import { afterAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anyCategoryId, firstTwoNumberValueIds, twoByTwoOptionSelections } from "@tests/support/fixtures";
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
    expect(res.data!.kind).toBe(PRODUCT_LOOKUP_KIND.VARIANT_SELECTION);
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

  // The kind of product is an explicit flag, not a guess made from the variant
  // types it happens to use, and it is enforced on the backend (CLAUDE.md rule
  // 5) — the two shapes never mix, whichever screen the request came from.
  it("refuses colours and sizes on a numbered product, at creation and afterwards", async () => {
    const admin = await getSession("ADMIN");
    const categoryId = await anyCategoryId(admin.token);
    const optionSelections = await twoByTwoOptionSelections(admin.token);
    const name = `Vitest Numbered Reject ${uniqueId()}`;

    const created = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: admin.token,
      body: { name: { ar: name, en: name }, categoryId, basePrice: "80", isNumbered: true, optionSelections },
    });
    expect(created.status).toBe(400);
    expect(created.error?.code).toBe(ERROR_CODES.PRODUCT_NUMBERED_ONLY_NUMBERS);

    // And the same refusal on a numbered product that already exists — the
    // generate endpoint is the other way colours could sneak in.
    const { product } = await createNumberedShawl(admin.token, { stocks: [1, 1] });
    createdProductIds.push(product.id);

    const generated = await apiRequest(`/api/products/${product.id}/variants/generate`, {
      method: "POST",
      token: admin.token,
      body: { optionSelections },
    });
    expect(generated.status).toBe(400);
    expect(generated.error?.code).toBe(ERROR_CODES.PRODUCT_NUMBERED_ONLY_NUMBERS);

    // Refused means refused: the numbers it already had are untouched.
    const reloaded = await apiRequest<ProductDto>(`/api/products/${product.id}`, { token: admin.token });
    expect(reloaded.data!.variants).toHaveLength(2);
  });

  it("refuses numbers on an ordinary product, at creation and afterwards", async () => {
    const admin = await getSession("ADMIN");
    const categoryId = await anyCategoryId(admin.token);
    const { variantTypeId, valueIds } = await firstTwoNumberValueIds(admin.token);
    const numberSelections = [{ variantTypeId, valueIds }];
    const name = `Vitest Ordinary ${uniqueId()}`;

    // isNumbered left out entirely — the default is "an ordinary product".
    const created = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: admin.token,
      body: { name: { ar: name, en: name }, categoryId, basePrice: "80", optionSelections: numberSelections },
    });
    expect(created.status).toBe(400);
    expect(created.error?.code).toBe(ERROR_CODES.PRODUCT_NUMBERS_REQUIRE_NUMBERED);

    const ordinary = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: admin.token,
      body: {
        name: { ar: `${name} ok`, en: `${name} ok` },
        categoryId,
        basePrice: "80",
        optionSelections: await twoByTwoOptionSelections(admin.token),
      },
    });
    expect(ordinary.status).toBe(201);
    expect(ordinary.data!.isNumbered).toBe(false);
    createdProductIds.push(ordinary.data!.id);

    const generated = await apiRequest(`/api/products/${ordinary.data!.id}/variants/generate`, {
      method: "POST",
      token: admin.token,
      body: { optionSelections: numberSelections },
    });
    expect(generated.status).toBe(400);
    expect(generated.error?.code).toBe(ERROR_CODES.PRODUCT_NUMBERS_REQUIRE_NUMBERED);

    const reloaded = await apiRequest<ProductDto>(`/api/products/${ordinary.data!.id}`, { token: admin.token });
    expect(reloaded.data!.variants).toHaveLength(4);
  });

  it("refuses to change a product's kind while it still has variants, and destroys nothing", async () => {
    const admin = await getSession("ADMIN");
    const { product, numbers } = await createNumberedShawl(admin.token, { stocks: [2, 2] });
    createdProductIds.push(product.id);

    const patched = await apiRequest(`/api/products/${product.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { isNumbered: false },
    });
    expect(patched.status).toBe(409);
    expect(patched.error?.code).toBe(ERROR_CODES.PRODUCT_NUMBERED_SWITCH_HAS_VARIANTS);

    // Nothing was deleted to make the switch possible — the numbers, their
    // stock and the flag itself are all exactly as they were.
    const reloaded = await apiRequest<ProductDto>(`/api/products/${product.id}`, { token: admin.token });
    expect(reloaded.data!.isNumbered).toBe(true);
    expect(reloaded.data!.variants.map((v) => v.id)).toEqual(numbers.map((v) => v.id));
    expect(reloaded.data!.variants.every((v) => v.stock === 2)).toBe(true);
  });

  it("lets a product with no variants change kind, and then take numbers", async () => {
    const admin = await getSession("ADMIN");
    const categoryId = await anyCategoryId(admin.token);
    const { variantTypeId, valueIds } = await firstTwoNumberValueIds(admin.token);
    const name = `Vitest Kind Switch ${uniqueId()}`;

    const created = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: admin.token,
      body: { name: { ar: name, en: name }, categoryId, basePrice: "40" },
    });
    expect(created.status).toBe(201);
    expect(created.data!.isNumbered).toBe(false);
    createdProductIds.push(created.data!.id);

    const patched = await apiRequest<ProductDto>(`/api/products/${created.data!.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { isNumbered: true },
    });
    expect(patched.status).toBe(200);
    expect(patched.data!.isNumbered).toBe(true);

    // The numbers the placement tool would create are accepted only now.
    const generated = await apiRequest<ProductDto>(`/api/products/${created.data!.id}/variants/generate`, {
      method: "POST",
      token: admin.token,
      body: { optionSelections: [{ variantTypeId, valueIds }] },
    });
    expect(generated.status).toBe(201);
    expect(generated.data!.variants).toHaveLength(2);
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
