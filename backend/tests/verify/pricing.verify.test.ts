// ============================================================================
//  1. PRICING
//
//  What a piece costs the customer, and where that figure comes from.
//
//    * a variant's priceOverride is what is charged when it is set;
//    * an empty one inherits the parent's basePrice — RESOLVED AT READ TIME,
//      so re-pricing the parent afterwards reaches it (CLAUDE.md rule 3);
//    * cost follows exactly the same fallback;
//    * the SKU is frozen at creation and survives every later edit
//      (CLAUDE.md rule 1) — printed barcodes must never break;
//    * compareAtPrice is a "was" price and never touches what is charged.
// ============================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anotherCategoryId } from "@tests/support/fixtures";
import { expectCount, expectMoney, expectPrice } from "@tests/support/money";
import { createPricedProduct, createVariantProduct, readProduct, sell } from "@tests/support/verify";
import {
  COMPARE_AT_PRICE,
  REPRICED_BASE_PRICE,
  REPRICED_COST,
  UNIT_COST,
  UNIT_PRICE,
  VARIANT_COST_OVERRIDE,
  VARIANT_PRICE_OVERRIDE,
} from "@tests/constants";
import type { ProductDto } from "@tests/types";

describe("Verify · pricing", () => {
  let admin: string;

  beforeAll(async () => {
    admin = (await getSession("ADMIN")).token;
  });

  describe("the variant fallback", () => {
    it("charges the override when a variant has one, and the parent's price when it has none", async () => {
      const fixture = await createVariantProduct(admin, {
        basePrice: UNIT_PRICE,
        cost: UNIT_COST,
        priceOverride: VARIANT_PRICE_OVERRIDE,
        costOverride: VARIANT_COST_OVERRIDE,
      });

      expectPrice(fixture.overridden.resolvedPrice, VARIANT_PRICE_OVERRIDE, "overriding variant's resolved price");
      expectPrice(fixture.overridden.resolvedCost, VARIANT_COST_OVERRIDE, "overriding variant's resolved cost");

      // Nothing was set on this one, so both figures must come from the parent.
      expect(fixture.inheriting.priceOverride, "inheriting variant must hold no price of its own").toBeNull();
      expect(fixture.inheriting.cost, "inheriting variant must hold no cost of its own").toBeNull();
      expectPrice(fixture.inheriting.resolvedPrice, UNIT_PRICE, "inheriting variant's resolved price");
      expectPrice(fixture.inheriting.resolvedCost, UNIT_COST, "inheriting variant's resolved cost");
    });

    it("charges each variant its own resolved price when both are sold on one order", async () => {
      const fixture = await createVariantProduct(admin, {
        priceOverride: VARIANT_PRICE_OVERRIDE,
        costOverride: VARIANT_COST_OVERRIDE,
      });

      const order = await sell(admin, [
        { productId: fixture.id, variantId: fixture.overridden.id, quantity: 1 },
        { productId: fixture.id, variantId: fixture.inheriting.id, quantity: 1 },
      ]);

      const overridden = order.items.find((item) => item.variantId === fixture.overridden.id)!;
      const inheriting = order.items.find((item) => item.variantId === fixture.inheriting.id)!;

      expectMoney(overridden.unitPrice, VARIANT_PRICE_OVERRIDE, "sold line: overriding variant's unit price");
      expectMoney(overridden.unitCost, VARIANT_COST_OVERRIDE, "sold line: overriding variant's unit cost");
      expectMoney(inheriting.unitPrice, UNIT_PRICE, "sold line: inheriting variant's unit price");
      expectMoney(inheriting.unitCost, UNIT_COST, "sold line: inheriting variant's unit cost");

      // 130.50 + 100.00, with no discount anywhere.
      expectMoney(order.total, "230.50", "order total across both variants");
    });

    it("follows the parent when the parent is re-priced — the fallback is resolved, never copied", async () => {
      const fixture = await createVariantProduct(admin, {
        basePrice: UNIT_PRICE,
        cost: UNIT_COST,
        priceOverride: VARIANT_PRICE_OVERRIDE,
        costOverride: VARIANT_COST_OVERRIDE,
      });

      const repriced = await apiRequest<ProductDto>(`/api/products/${fixture.id}`, {
        method: "PATCH",
        token: admin,
        body: { basePrice: REPRICED_BASE_PRICE, cost: REPRICED_COST },
      });
      expect(repriced.status, "an Admin may re-price a product outright").toBe(200);

      const after = await readProduct(admin, fixture.id);
      const overridden = after.variants.find((variant) => variant.id === fixture.overridden.id)!;
      const inheriting = after.variants.find((variant) => variant.id === fixture.inheriting.id)!;

      // The inheriting variant moved with the parent...
      expectPrice(inheriting.resolvedPrice, REPRICED_BASE_PRICE, "inheriting variant's price after the parent moved");
      expectPrice(inheriting.resolvedCost, REPRICED_COST, "inheriting variant's cost after the parent moved");
      // ...and the one with its own figures did not.
      expectPrice(overridden.resolvedPrice, VARIANT_PRICE_OVERRIDE, "overriding variant's price after the parent moved");
      expectPrice(overridden.resolvedCost, VARIANT_COST_OVERRIDE, "overriding variant's cost after the parent moved");
    });
  });

  describe("the frozen SKU (CLAUDE.md rule 1)", () => {
    it("keeps a simple product's SKU through a rename, a re-price and a category change", async () => {
      const fixture = await createPricedProduct(admin);
      const sku = fixture.product.sku;

      expect(sku, "a simple product is created with an ORG-##### SKU").toMatch(/^ORG-\d{5}$/);

      const otherCategory = await anotherCategoryId(admin, fixture.product.category?.id ?? "");
      const edited = await apiRequest<ProductDto>(`/api/products/${fixture.id}`, {
        method: "PATCH",
        token: admin,
        body: {
          name: { ar: `اسم جديد ${uniqueId()}`, en: `[verify] renamed ${uniqueId()}` },
          basePrice: REPRICED_BASE_PRICE,
          compareAtPrice: COMPARE_AT_PRICE,
          categoryId: otherCategory,
        },
      });

      expect(edited.status, "the edit itself must succeed").toBe(200);
      expect(edited.data?.sku, `SKU must be frozen at creation — it was ${sku}`).toBe(sku);

      const reloaded = await readProduct(admin, fixture.id);
      expect(reloaded.sku, "and still frozen when read back").toBe(sku);
      // The barcode is generated once too, and is not the SKU (rule 13).
      expect(reloaded.barcode, "barcode must be frozen alongside it").toBe(fixture.product.barcode);
    });

    it("keeps a variant's ORG-#####-N SKU through a re-price of the variant and the parent", async () => {
      const fixture = await createVariantProduct(admin, {
        priceOverride: VARIANT_PRICE_OVERRIDE,
        costOverride: VARIANT_COST_OVERRIDE,
      });
      const skus = fixture.product.variants.map((variant) => variant.sku);
      for (const sku of skus) expect(sku, "variant SKUs are ORG-#####-N").toMatch(/^ORG-\d{5}-\d+$/);

      await apiRequest(`/api/products/${fixture.id}/variants/${fixture.overridden.id}`, {
        method: "PATCH",
        token: admin,
        body: { priceOverride: REPRICED_BASE_PRICE, name: { ar: "لون آخر", en: "[verify] renamed variant" } },
      });
      await apiRequest(`/api/products/${fixture.id}`, {
        method: "PATCH",
        token: admin,
        body: { basePrice: REPRICED_BASE_PRICE },
      });

      const after = await readProduct(admin, fixture.id);
      expect(
        after.variants.map((variant) => variant.sku),
        `variant SKUs must be frozen at creation — they were ${skus.join(", ")}`
      ).toEqual(skus);
    });
  });

  describe("compareAtPrice", () => {
    it("never changes what is charged, however high it is set", async () => {
      const fixture = await createPricedProduct(admin, {
        basePrice: UNIT_PRICE,
        compareAtPrice: COMPARE_AT_PRICE,
      });

      expectPrice(fixture.product.compareAtPrice, COMPARE_AT_PRICE, "the 'was' price on the product");

      const order = await sell(admin, [{ productId: fixture.id, quantity: 2 }]);
      expectMoney(order.items[0].unitPrice, UNIT_PRICE, "unit price charged (must ignore compareAtPrice)");
      expectMoney(order.items[0].lineTotal, "200.00", "line total for 2 x 100.00");
      expectMoney(order.subtotal, "200.00", "order subtotal");
      expectMoney(order.total, "200.00", "order total (compareAtPrice must not discount anything)");
    });

    it("never changes what is charged when it is set BELOW the base price either", async () => {
      // A "was" price lower than the current one is nonsense on a tag, but it
      // must not become a discount if somebody types it.
      const fixture = await createPricedProduct(admin, { basePrice: UNIT_PRICE, compareAtPrice: "1.00" });
      const order = await sell(admin, [{ productId: fixture.id, quantity: 1 }]);

      expectMoney(order.total, UNIT_PRICE, "order total with a compareAtPrice of 1.00");
      expectMoney(order.discountAmount, "0.00", "discount recorded (there was none)");
    });
  });

  describe("what a sale freezes", () => {
    it("snapshots price and cost onto the line, and does not move them when the catalogue does", async () => {
      const fixture = await createPricedProduct(admin, { basePrice: UNIT_PRICE, cost: UNIT_COST });
      const order = await sell(admin, [{ productId: fixture.id, quantity: 1 }]);

      await apiRequest(`/api/products/${fixture.id}`, {
        method: "PATCH",
        token: admin,
        body: { basePrice: "999.99", cost: "888.88" },
      });

      const after = await apiRequest<{ items: { unitPrice: string; unitCost: string }[] }>(
        `/api/orders/${order.id}`,
        { token: admin }
      );
      expectMoney(after.data!.items[0].unitPrice, UNIT_PRICE, "snapshotted unit price after the product was re-priced");
      expectMoney(after.data!.items[0].unitCost, UNIT_COST, "snapshotted unit cost after the product was re-costed");
      expectCount(after.data!.items.length, 1, "the order still has exactly its one line");
    });
  });
});
