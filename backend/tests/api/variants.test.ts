import { afterAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "../support/client";
import { getSession } from "../support/auth";
import { anyCategoryId, twoByTwoOptionSelections } from "../support/fixtures";
import { SKU_PAD_LENGTH, SKU_PREFIX } from "@/constants";

const variantSkuPattern = new RegExp(`^${SKU_PREFIX}\\d{${SKU_PAD_LENGTH}}-\\d+$`);

interface VariantDto {
  id: string;
  sku: string;
  priceOverride: number | string | null;
  resolvedPrice: number | string;
  cost?: number | string | null;
  resolvedCost?: number | string | null;
}

interface ProductDto {
  id: string;
  sku: string | null;
  hasVariants: boolean;
  basePrice: number | string;
  cost?: number | string | null;
  variants: VariantDto[];
}

describe("Variants", () => {
  const createdProductIds: string[] = [];

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    for (const id of createdProductIds) {
      await apiRequest(`/api/products/${id}`, { method: "DELETE", token: admin.token });
    }
  });

  it("generates a 2x2 cartesian set of 4 variants, disables the parent SKU, and resolves price/cost fallback", async () => {
    const admin = await getSession("ADMIN");
    const categoryId = await anyCategoryId(admin.token);
    const optionSelections = await twoByTwoOptionSelections(admin.token);
    const name = `Vitest Variant ${uniqueId()}`;

    const created = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: admin.token,
      body: { name: { ar: name, en: name }, categoryId, basePrice: "150", cost: "60", optionSelections },
    });
    expect(created.status).toBe(201);
    const product = created.data!;
    createdProductIds.push(product.id);

    // Parent SKU is disabled once the product carries variants.
    expect(product.sku).toBeNull();
    expect(product.hasVariants).toBe(true);
    expect(product.variants).toHaveLength(4);

    const skus = new Set(product.variants.map((v) => v.sku));
    expect(skus.size).toBe(4);
    for (const variant of product.variants) {
      expect(variant.sku).toMatch(variantSkuPattern);
      // No override supplied on create -> fallback to the parent's basePrice/cost.
      expect(variant.priceOverride).toBeNull();
      expect(Number(variant.resolvedPrice)).toBe(Number(product.basePrice));
      expect(variant.cost ?? null).toBeNull();
      expect(Number(variant.resolvedCost)).toBe(Number(product.cost));
    }

    // Overriding one variant must not affect the others' fallback resolution.
    const target = product.variants[0];
    const patched = await apiRequest<VariantDto>(`/api/products/${product.id}/variants/${target.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { priceOverride: "175.50", cost: "80" },
    });
    expect(patched.status).toBe(200);
    expect(Number(patched.data!.resolvedPrice)).toBe(175.5);
    expect(Number(patched.data!.resolvedCost)).toBe(80);

    const refreshed = await apiRequest<ProductDto>(`/api/products/${product.id}`, { token: admin.token });
    const others = refreshed.data!.variants.filter((v) => v.id !== target.id);
    expect(others).toHaveLength(3);
    for (const variant of others) {
      expect(Number(variant.resolvedPrice)).toBe(Number(refreshed.data!.basePrice));
    }
    const overridden = refreshed.data!.variants.find((v) => v.id === target.id)!;
    expect(Number(overridden.resolvedPrice)).toBe(175.5);
  });
});
