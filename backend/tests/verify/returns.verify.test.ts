// ============================================================================
//  4. RETURNS
//
//    * a partial return restores the exact quantity that came back, records
//      it on the line, and leaves the rest of the sale standing;
//    * a full return restores everything and closes the order as RETURNED;
//    * the same units can never be returned twice, and more than was sold can
//      never be returned at all;
//    * sales and profit follow the goods: a returned unit stops counting as
//      revenue and its cost stops counting as COGS.
// ============================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { getSession } from "@tests/support/auth";
import { expectCount, expectDelta, expectMoney } from "@tests/support/money";
import { salesReport } from "@tests/support/reports";
import {
  createPricedProduct,
  createVariantProduct,
  readOrder,
  readStock,
  returnOrderRequest,
  sell,
  sellOnCredit,
} from "@tests/support/verify";
import { UNIT_COST, UNIT_PRICE, VARIANT_COST_OVERRIDE, VARIANT_PRICE_OVERRIDE } from "@tests/constants";

describe("Verify · returns", () => {
  let admin: string;

  beforeAll(async () => {
    admin = (await getSession("ADMIN")).token;
  });

  describe("what comes back", () => {
    it("restores exactly the quantity returned, and records it on the line", async () => {
      const product = await createPricedProduct(admin, { stock: 10 });
      const order = await sell(admin, [{ productId: product.id, quantity: 5 }]);
      expectCount(await readStock(admin, product.id), 5, "stock after selling 5 of 10");

      const returned = await returnOrderRequest(admin, order.id, [
        { orderItemId: order.items[0].id, quantity: 2 },
      ]);

      expect(returned.status, "a partial return must succeed").toBe(200);
      expectCount(returned.data!.items[0].returnedQuantity, 2, "returnedQuantity on the line");
      expectCount(returned.data!.items[0].quantity, 5, "the quantity SOLD must not change");
      expect(returned.data!.status, "a partly returned order is still the sale it was").toBe("COMPLETED");
      expectCount(await readStock(admin, product.id), 7, "stock after 2 of 5 came back");
    });

    it("returns the rest, closes the order as RETURNED, and puts every unit back", async () => {
      const product = await createPricedProduct(admin, { stock: 10 });
      const order = await sell(admin, [{ productId: product.id, quantity: 5 }]);

      await returnOrderRequest(admin, order.id, [{ orderItemId: order.items[0].id, quantity: 2 }]);
      const rest = await returnOrderRequest(admin, order.id, [{ orderItemId: order.items[0].id, quantity: 3 }]);

      expect(rest.status, "returning the remainder must succeed").toBe(200);
      expectCount(rest.data!.items[0].returnedQuantity, 5, "returnedQuantity once everything is back");
      expect(rest.data!.status, "an order with nothing left out is RETURNED").toBe("RETURNED");
      expect(rest.data!.stockDeductedAt, "and holds no stock any more").toBeNull();
      expectCount(await readStock(admin, product.id), 10, "stock once the whole sale came back");
    });

    it("returns a whole order in one go when no lines are named", async () => {
      const fixture = await createVariantProduct(admin, {
        priceOverride: VARIANT_PRICE_OVERRIDE,
        costOverride: VARIANT_COST_OVERRIDE,
        variantStock: 6,
      });
      const order = await sell(admin, [
        { productId: fixture.id, variantId: fixture.overridden.id, quantity: 2 },
        { productId: fixture.id, variantId: fixture.inheriting.id, quantity: 3 },
      ]);

      const returned = await returnOrderRequest(admin, order.id);
      expect(returned.status, "returning everything must succeed").toBe(200);
      expect(returned.data!.status).toBe("RETURNED");

      expectCount(await readStock(admin, fixture.id, fixture.overridden.id), 6, "first variant fully restored");
      expectCount(await readStock(admin, fixture.id, fixture.inheriting.id), 6, "second variant fully restored");
    });

    it("returns an online sale that has already gone out with the courier", async () => {
      const product = await createPricedProduct(admin, { stock: 10 });
      const order = await sellOnCredit(admin, [{ productId: product.id, quantity: 3 }]);
      expectCount(await readStock(admin, product.id), 7, "stock once the parcel left");

      const returned = await returnOrderRequest(admin, order.id);
      expect(returned.status, "a refused parcel comes back through returns").toBe(200);
      expectCount(await readStock(admin, product.id), 10, "stock once the parcel came back");
    });
  });

  describe("what cannot come back", () => {
    it("refuses more than was sold, and moves nothing", async () => {
      const product = await createPricedProduct(admin, { stock: 10 });
      const order = await sell(admin, [{ productId: product.id, quantity: 2 }]);

      const tooMany = await returnOrderRequest(admin, order.id, [
        { orderItemId: order.items[0].id, quantity: 3 },
      ]);
      expect(tooMany.status, "returning 3 of a sale of 2 must be refused").toBe(400);
      expect(tooMany.error?.code).toBe("error.order.return_quantity_exceeded");
      expectCount(await readStock(admin, product.id), 8, "stock after the refused return");

      const stored = await readOrder(admin, order.id);
      expectCount(stored.items[0].returnedQuantity, 0, "nothing was recorded as returned");
    });

    it("refuses two entries for the same line that together exceed what was sold", async () => {
      const product = await createPricedProduct(admin, { stock: 10 });
      const order = await sell(admin, [{ productId: product.id, quantity: 2 }]);

      const res = await returnOrderRequest(admin, order.id, [
        { orderItemId: order.items[0].id, quantity: 1 },
        { orderItemId: order.items[0].id, quantity: 2 },
      ]);
      expect(res.status, "1 + 2 against a sale of 2 must be refused").toBe(400);
      expectCount(await readStock(admin, product.id), 8, "stock after the refused return");
    });

    it("refuses to return the same units twice", async () => {
      const product = await createPricedProduct(admin, { stock: 10 });
      const order = await sell(admin, [{ productId: product.id, quantity: 2 }]);

      const first = await returnOrderRequest(admin, order.id, [{ orderItemId: order.items[0].id, quantity: 2 }]);
      expect(first.status, "the first return must succeed").toBe(200);
      expectCount(await readStock(admin, product.id), 10, "stock after the whole sale came back");

      // The same units again, both ways of asking.
      const named = await returnOrderRequest(admin, order.id, [{ orderItemId: order.items[0].id, quantity: 1 }]);
      expect(named.status, "returning an already-returned unit must be refused").toBe(400);

      const whole = await returnOrderRequest(admin, order.id);
      expect(whole.status, "and so must returning the whole order again").toBe(409);
      expect(whole.error?.code).toBe("error.order.not_returnable");

      expectCount(await readStock(admin, product.id), 10, "stock after both refused re-returns");
      expectCount((await readOrder(admin, order.id)).items[0].returnedQuantity, 2, "returnedQuantity is still 2");
    });

    it("refuses a return before the goods have left the shop", async () => {
      const product = await createPricedProduct(admin, { stock: 10 });
      const order = await sell(admin, [{ productId: product.id, quantity: 2 }], { channel: "WHATSAPP" });

      const res = await returnOrderRequest(admin, order.id);
      expect(res.status, "nothing has gone out, so nothing can come back").toBe(409);
      expect(res.error?.code).toBe("error.order.not_returnable");
      expectCount(await readStock(admin, product.id), 10, "stock untouched");
    });

    it("refuses a line that belongs to a different order", async () => {
      const product = await createPricedProduct(admin, { stock: 10 });
      const mine = await sell(admin, [{ productId: product.id, quantity: 1 }]);
      const theirs = await sell(admin, [{ productId: product.id, quantity: 1 }]);

      const res = await returnOrderRequest(admin, mine.id, [
        { orderItemId: theirs.items[0].id, quantity: 1 },
      ]);
      expect(res.status, "a line from another order is not this order's to return").toBe(400);
      expect(res.error?.code).toBe("error.order.item_not_found");
      expectCount(await readStock(admin, product.id), 8, "stock after the refused return");
    });
  });

  describe("what the books say afterwards", () => {
    it("takes a returned unit's revenue AND its cost back out of the figures", async () => {
      const product = await createPricedProduct(admin, { basePrice: UNIT_PRICE, cost: UNIT_COST, stock: 10 });

      const before = await salesReport(admin);
      const order = await sell(admin, [{ productId: product.id, quantity: 4 }]);
      const afterSale = await salesReport(admin);

      // 4 x 100.00 sold, 4 x 40.00 of it bought in.
      expectDelta(afterSale.totals.revenue, before.totals.revenue, "400.00", "revenue after selling 4");
      expectDelta(afterSale.totals.cost, before.totals.cost, "160.00", "COGS after selling 4");
      expectDelta(afterSale.totals.profit, before.totals.profit, "240.00", "gross profit after selling 4");

      await returnOrderRequest(admin, order.id, [{ orderItemId: order.items[0].id, quantity: 1 }]);
      const afterReturn = await salesReport(admin);

      // Exactly one unit's worth comes back out of each figure.
      expectDelta(afterReturn.totals.revenue, afterSale.totals.revenue, "-100.00", "revenue after returning 1");
      expectDelta(afterReturn.totals.cost, afterSale.totals.cost, "-40.00", "COGS after returning 1");
      expectDelta(afterReturn.totals.profit, afterSale.totals.profit, "-60.00", "gross profit after returning 1");

      // ...and the returns block says what came back.
      expectDelta(afterReturn.returns.amount, afterSale.returns.amount, "100.00", "returned amount");
      expectCount(
        afterReturn.returns.itemCount - afterSale.returns.itemCount,
        1,
        "returned item count"
      );
    });

    it("nets a fully returned order back to exactly nothing", async () => {
      const product = await createPricedProduct(admin, { basePrice: UNIT_PRICE, cost: UNIT_COST, stock: 10 });

      const before = await salesReport(admin);
      const order = await sell(admin, [{ productId: product.id, quantity: 3 }]);
      await returnOrderRequest(admin, order.id);
      const after = await salesReport(admin);

      expectDelta(after.totals.revenue, before.totals.revenue, "0.00", "revenue over a sale that came back whole");
      expectDelta(after.totals.cost, before.totals.cost, "0.00", "COGS over a sale that came back whole");
      expectDelta(after.totals.profit, before.totals.profit, "0.00", "profit over a sale that came back whole");
      expectCount(
        after.totals.orderCount - before.totals.orderCount,
        0,
        "order count (a fully returned order sold nothing)"
      );
    });

    it("takes a returned online sale out of what the delivery company still owes", async () => {
      const product = await createPricedProduct(admin, { basePrice: UNIT_PRICE, cost: UNIT_COST, stock: 10 });

      const before = await salesReport(admin);
      const order = await sellOnCredit(admin, [{ productId: product.id, quantity: 2 }]);
      const owed = await salesReport(admin);
      expectDelta(
        owed.totals.pendingCollectionAmount,
        before.totals.pendingCollectionAmount,
        "200.00",
        "money owed after the parcel left"
      );

      await returnOrderRequest(admin, order.id);
      const after = await salesReport(admin);
      expectDelta(
        after.totals.pendingCollectionAmount,
        owed.totals.pendingCollectionAmount,
        "-200.00",
        "money owed after the parcel came back"
      );
      expectMoney(
        after.profit!.owed,
        after.totals.pendingCollectionAmount,
        "the profit block and the totals must quote the same owed figure"
      );
    });
  });
});
