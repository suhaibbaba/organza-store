// ============================================================================
//  3. QUANTITIES AND STOCK
//
//    * a quantity is a whole number: 1.5, 0, -1 and "two" are all refused;
//    * a counter sale takes stock off the shelf at once; an online order
//      takes it when preparation starts, and NOT before (spec.md);
//    * stockDeductedAt is the single source of truth, so walking an order
//      back and forth through its statuses can never deduct twice;
//    * selling more than is on the shelf is refused, and stock never goes
//      negative — not by one sale, not by two lines of the same variant.
// ============================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { expectCount } from "@tests/support/money";
import {
  createPricedProduct,
  createVariantProduct,
  readOrder,
  readStock,
  sell,
  sellRequest,
  setStatus,
} from "@tests/support/verify";
import { UNIT_PRICE, VARIANT_COST_OVERRIDE, VARIANT_PRICE_OVERRIDE } from "@tests/constants";
import type { OrderDto } from "@tests/types";

describe("Verify · quantities and stock", () => {
  let admin: string;

  beforeAll(async () => {
    admin = (await getSession("ADMIN")).token;
  });

  describe("a quantity is a whole number of things", () => {
    it("refuses a fraction, a zero, a negative and a word", async () => {
      const product = await createPricedProduct(admin, { stock: 10 });

      for (const quantity of [1.5, 0, -1, "two", null, "", 1e9 + 0.5] as unknown[]) {
        const res = await sellRequest(admin, [{ productId: product.id, quantity } as never]);
        expect(res.status, `a quantity of ${JSON.stringify(quantity)} must be refused`).toBe(400);
        expect(res.success, "and refused through the error envelope").toBe(false);
      }

      expectCount(await readStock(admin, product.id), 10, "stock after every refused quantity");
    });

    it("refuses a fractional and a negative stock figure on a manual adjustment", async () => {
      const product = await createPricedProduct(admin, { stock: 10 });

      for (const stock of ["2.5", "-1", "abc"]) {
        const res = await apiRequest(`/api/inventory/products/${product.id}`, {
          method: "PATCH",
          token: admin,
          body: { stock },
        });
        expect(res.status, `a manual stock of ${stock} must be refused`).toBe(400);
      }

      expectCount(await readStock(admin, product.id), 10, "stock after every refused adjustment");
    });
  });

  describe("a counter sale", () => {
    it("takes exactly what was sold off the shelf, once", async () => {
      const product = await createPricedProduct(admin, { stock: 10 });

      const order = await sell(admin, [{ productId: product.id, quantity: 3 }]);
      expect(order.status, "a counter sale opens finished").toBe("COMPLETED");
      expect(order.stockDeductedAt, "and holds its stock from the moment it is rung up").not.toBeNull();

      expectCount(await readStock(admin, product.id), 7, "stock after selling 3 of 10");
      // Reading it again must not move it — a deduction is not a view.
      expectCount(await readStock(admin, product.id), 7, "stock read a second time");
    });

    it("aggregates the same variant listed twice into one deduction", async () => {
      const fixture = await createVariantProduct(admin, {
        priceOverride: VARIANT_PRICE_OVERRIDE,
        costOverride: VARIANT_COST_OVERRIDE,
        variantStock: 5,
      });

      await sell(admin, [
        { productId: fixture.id, variantId: fixture.overridden.id, quantity: 2 },
        { productId: fixture.id, variantId: fixture.overridden.id, quantity: 1 },
      ]);

      expectCount(
        await readStock(admin, fixture.id, fixture.overridden.id),
        2,
        "variant stock after two lines totalling 3 of 5"
      );
      expectCount(
        await readStock(admin, fixture.id, fixture.inheriting.id),
        5,
        "the other variant must not have moved"
      );
    });
  });

  describe("an online order", () => {
    it("holds no stock until PREPARING, and holds it exactly once from then on", async () => {
      const product = await createPricedProduct(admin, { stock: 10 });

      const order = await sell(admin, [{ productId: product.id, quantity: 4 }], { channel: "WHATSAPP" });
      expect(order.status, "an online order opens NEW").toBe("NEW");
      expect(order.stockDeductedAt, "and holds nothing yet").toBeNull();
      expectCount(await readStock(admin, product.id), 10, "stock while the order is only NEW");

      const preparing = await setStatus(admin, order.id, "PREPARING");
      expect(preparing.status, "moving to PREPARING must succeed").toBe(200);
      expect(preparing.data!.stockDeductedAt, "PREPARING is when the goods are committed").not.toBeNull();
      expectCount(await readStock(admin, product.id), 6, "stock once preparation starts");

      const stampedAt = preparing.data!.stockDeductedAt;

      // Every illegal re-entry into a deducting state, one after another.
      // Each must be refused, and none of them may move stock again.
      for (const attempt of ["PREPARING", "NEW"]) {
        const res = await setStatus(admin, order.id, attempt);
        expect(res.status, `PREPARING -> ${attempt} is not a legal move`).toBe(400);
        expectCount(await readStock(admin, product.id), 6, `stock after a refused move to ${attempt}`);
      }

      const handed = await setStatus(admin, order.id, "HANDED_TO_COURIER");
      expect(handed.status, "handing it to the courier must succeed").toBe(200);
      expect(handed.data!.stockDeductedAt, "and must not re-stamp the deduction").toBe(stampedAt);
      expectCount(await readStock(admin, product.id), 6, "stock after the courier handover");

      // HANDED_TO_COURIER is the end of the line — nothing may take it back
      // through PREPARING and deduct a second time.
      const again = await setStatus(admin, order.id, "PREPARING");
      expect(again.status, "HANDED_TO_COURIER -> PREPARING is not a legal move").toBe(400);
      expectCount(await readStock(admin, product.id), 6, "stock after trying to go back to PREPARING");
    });

    it("puts committed stock back on a cancellation, and takes nothing back from an uncommitted one", async () => {
      const product = await createPricedProduct(admin, { stock: 10 });

      // Cancelled before it ever held anything: stock must not go UP.
      const untouched = await sell(admin, [{ productId: product.id, quantity: 2 }], { channel: "WHATSAPP" });
      const cancelledEarly = await setStatus(admin, untouched.id, "CANCELLED");
      expect(cancelledEarly.status, "cancelling a NEW order must succeed").toBe(200);
      expectCount(await readStock(admin, product.id), 10, "stock after cancelling an order that held nothing");

      // Cancelled after it did: stock must come back, exactly once.
      const committed = await sell(admin, [{ productId: product.id, quantity: 3 }], { channel: "WHATSAPP" });
      await setStatus(admin, committed.id, "PREPARING");
      expectCount(await readStock(admin, product.id), 7, "stock once the second order is preparing");

      const cancelled = await setStatus(admin, committed.id, "CANCELLED");
      expect(cancelled.status, "cancelling a PREPARING order must succeed").toBe(200);
      expect(cancelled.data!.stockDeductedAt, "a cancelled order holds nothing").toBeNull();
      expectCount(await readStock(admin, product.id), 10, "stock after the cancellation put it back");

      // A cancelled order is terminal, so no further move can restore twice.
      const after = await setStatus(admin, committed.id, "PREPARING");
      expect(after.status, "nothing moves out of CANCELLED").toBe(400);
      expectCount(await readStock(admin, product.id), 10, "stock after a refused move out of CANCELLED");
    });
  });

  describe("the shelf is the limit", () => {
    it("refuses to sell more than is on it, and moves nothing", async () => {
      const product = await createPricedProduct(admin, { stock: 2 });

      const res = await sellRequest(admin, [{ productId: product.id, quantity: 3 }]);
      expect(res.status, "overselling must be refused").toBe(409);
      expect(res.error?.code, "with the insufficient-stock key").toBe("error.order.insufficient_stock");
      expectCount(await readStock(admin, product.id), 2, "stock after a refused oversell");
    });

    it("refuses two lines that together exceed the shelf, even though each fits", async () => {
      const product = await createPricedProduct(admin, { stock: 3 });

      const res = await sellRequest(admin, [
        { productId: product.id, quantity: 2 },
        { productId: product.id, quantity: 2 },
      ]);
      expect(res.status, "2 + 2 of 3 must be refused").toBe(409);
      expectCount(await readStock(admin, product.id), 3, "stock after the refused order");

      // ...and the same shelf still sells exactly what it has.
      await sell(admin, [
        { productId: product.id, quantity: 2 },
        { productId: product.id, quantity: 1 },
      ]);
      expectCount(await readStock(admin, product.id), 0, "stock after selling all 3");
    });

    it("never lets stock go negative, however many sales are attempted against an empty shelf", async () => {
      const product = await createPricedProduct(admin, { stock: 1 });

      await sell(admin, [{ productId: product.id, quantity: 1 }]);
      expectCount(await readStock(admin, product.id), 0, "stock after the last piece is sold");

      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await sellRequest(admin, [{ productId: product.id, quantity: 1 }]);
        expect(res.status, "selling from an empty shelf must be refused").toBe(409);
        expectCount(await readStock(admin, product.id), 0, `stock after refused sale ${attempt + 1}`);
      }
    });

    it("refuses to sell the parent of a product that has variants", async () => {
      const fixture = await createVariantProduct(admin, {
        priceOverride: VARIANT_PRICE_OVERRIDE,
        costOverride: VARIANT_COST_OVERRIDE,
        variantStock: 4,
      });

      const res = await sellRequest(admin, [{ productId: fixture.id, quantity: 1 }]);
      expect(res.status, "the parent owns neither the price nor the stock").toBe(400);
      expect(res.error?.code).toBe("error.order.variant_required");
      expectCount(await readStock(admin, fixture.id, fixture.overridden.id), 4, "no variant stock moved");
    });
  });

  describe("deleting an order", () => {
    it("puts its stock back exactly once, and hides it from every view", async () => {
      const product = await createPricedProduct(admin, { basePrice: UNIT_PRICE, stock: 10 });
      const order = await sell(admin, [{ productId: product.id, quantity: 4 }]);
      expectCount(await readStock(admin, product.id), 6, "stock after the sale");

      const deleted = await apiRequest(`/api/orders/${order.id}`, { method: "DELETE", token: admin });
      expect(deleted.status, "an Admin may delete an order").toBe(200);
      expectCount(await readStock(admin, product.id), 10, "stock after the deletion put it back");

      const gone = await apiRequest<OrderDto>(`/api/orders/${order.id}`, { token: admin });
      expect(gone.status, "a deleted order is invisible everywhere").toBe(404);

      // Deleting again must not restore a second time.
      const twice = await apiRequest(`/api/orders/${order.id}`, { method: "DELETE", token: admin });
      expect(twice.status, "there is nothing left to delete").toBe(404);
      expectCount(await readStock(admin, product.id), 10, "stock after the second delete attempt");
    });
  });

  describe("what the shop was told", () => {
    it("reports the same stock through the product, the order and the inventory view", async () => {
      const product = await createPricedProduct(admin, { stock: 8 });
      const order = await sell(admin, [{ productId: product.id, quantity: 5 }]);

      expectCount(await readStock(admin, product.id), 3, "stock on the product");
      expectCount((await readOrder(admin, order.id)).items[0].quantity, 5, "quantity on the sold line");

      // The inventory list is looked up by the SKU printed on the item, which
      // is how a staff member would find it too.
      const inventory = await apiRequest<{ type: string; productId: string; stock: number }[]>(
        `/api/inventory?q=${encodeURIComponent(product.product.sku!)}&pageSize=100`,
        { token: admin }
      );
      expect(inventory.status, "the inventory list must answer an Admin").toBe(200);
      const row = (inventory.data ?? []).find(
        (entry) => entry.productId === product.id && entry.type === "product"
      );
      expect(row, `the product must appear in the inventory view under SKU ${product.product.sku}`).toBeDefined();
      expectCount(row!.stock, 3, "stock in the inventory view");
    });
  });
});
