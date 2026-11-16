// ============================================================================
//  6. SOLD vs RECEIVED vs OWED
//
//  "What we sold" and "what we hold" are two different figures, and the whole
//  reporting layer exists so they can never be read as one:
//
//      sold = received + owed          (always, to the agora)
//
//    * a counter sale is received the moment it is rung up;
//    * a courier order is owed until the delivery company settles up;
//    * marking it collected moves the amount from owed to received and leaves
//      sold exactly where it was;
//    * a cancelled or fully returned sale owes nothing and is out of all three;
//    * settling a batch takes the orders that were pending AT THAT MOMENT —
//      an order taken afterwards is still pending.
// ============================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { expectCount, expectCountDelta, expectDelta, expectMoney, expectSum } from "@tests/support/money";
import { salesReport } from "@tests/support/reports";
import {
  collect,
  createPricedProduct,
  readOrder,
  returnOrderRequest,
  sell,
  sellOnCredit,
  setStatus,
} from "@tests/support/verify";
import { UNIT_COST, UNIT_PRICE } from "@tests/constants";
import type { CollectionSummaryDto, OrderSummaryDto, PricedProduct } from "@tests/types";

describe("Verify · sold vs received vs owed", () => {
  let admin: string;
  let product: PricedProduct;

  beforeAll(async () => {
    admin = (await getSession("ADMIN")).token;
    product = await createPricedProduct(admin, { basePrice: UNIT_PRICE, cost: UNIT_COST, stock: 200 });
  });

  describe("the three figures", () => {
    it("counts a counter sale as sold AND received, owing nothing", async () => {
      const before = await salesReport(admin);
      await sell(admin, [{ productId: product.id, quantity: 2 }]);
      const after = await salesReport(admin);

      expectDelta(after.profit!.sold, before.profit!.sold, "200.00", "sold");
      expectDelta(after.profit!.received, before.profit!.received, "200.00", "received");
      expectDelta(after.profit!.owed, before.profit!.owed, "0.00", "owed");
      expectCountDelta(after.profit!.owedOrderCount, before.profit!.owedOrderCount, 0, "orders owed on");
    });

    it("counts a courier sale as sold but OWED, receiving nothing yet", async () => {
      const before = await salesReport(admin);
      await sellOnCredit(admin, [{ productId: product.id, quantity: 3 }]);
      const after = await salesReport(admin);

      expectDelta(after.profit!.sold, before.profit!.sold, "300.00", "sold");
      expectDelta(after.profit!.received, before.profit!.received, "0.00", "received (the courier holds it)");
      expectDelta(after.profit!.owed, before.profit!.owed, "300.00", "owed");
      expectCountDelta(after.profit!.owedOrderCount, before.profit!.owedOrderCount, 1, "orders owed on");
    });

    it("moves the money from owed to received when it is collected, leaving sold alone", async () => {
      const order = await sellOnCredit(admin, [{ productId: product.id, quantity: 4 }]);
      const owed = await salesReport(admin);

      const settled = await collect(admin, [order.id]);
      expect(settled.status, "an Admin records that the money arrived").toBe(200);

      const received = await salesReport(admin);
      expectDelta(received.profit!.sold, owed.profit!.sold, "0.00", "sold (unchanged — it was already sold)");
      expectDelta(received.profit!.received, owed.profit!.received, "400.00", "received");
      expectDelta(received.profit!.owed, owed.profit!.owed, "-400.00", "owed");

      const stored = await readOrder(admin, order.id);
      expect(stored.paymentStatus).toBe("COLLECTED");
      expect(stored.collectedAt, "and the moment it arrived is recorded").not.toBeNull();
    });

    it("reconciles: sold = received + owed, on the whole report and on every channel", async () => {
      // Make sure there is something of each kind in the window first.
      await sell(admin, [{ productId: product.id, quantity: 1 }]);
      await sellOnCredit(admin, [{ productId: product.id, quantity: 1 }]);

      const report = await salesReport(admin);

      expectSum([report.profit!.received, report.profit!.owed], report.profit!.sold, "sold = received + owed");
      expectMoney(report.profit!.sold, report.totals.revenue, "the profit block and the totals must agree on sold");
      expectSum(
        [report.totals.collectedRevenue, report.totals.pendingCollectionAmount],
        report.totals.revenue,
        "revenue = collected + pending"
      );

      for (const channel of report.byChannel) {
        expectSum(
          [channel.collectedRevenue, channel.pendingCollectionAmount],
          channel.revenue,
          `${channel.channel}: revenue = collected + pending`
        );
      }
    });

    it("drops a cancelled sale out of all three, though it was never collected", async () => {
      const order = await sell(admin, [{ productId: product.id, quantity: 2 }], { channel: "WHATSAPP" });
      await setStatus(admin, order.id, "PREPARING");
      const sold = await salesReport(admin);

      const cancelled = await setStatus(admin, order.id, "CANCELLED");
      expect(cancelled.status).toBe(200);

      const after = await salesReport(admin);
      expectDelta(after.profit!.sold, sold.profit!.sold, "-200.00", "sold after the cancellation");
      expectDelta(after.profit!.owed, sold.profit!.owed, "-200.00", "owed after the cancellation");
      expectDelta(after.profit!.received, sold.profit!.received, "0.00", "received (there never was any)");
    });

    it("drops a fully returned sale out of what is owed", async () => {
      const order = await sellOnCredit(admin, [{ productId: product.id, quantity: 2 }]);
      const owed = await salesReport(admin);

      await returnOrderRequest(admin, order.id);
      const after = await salesReport(admin);

      expectDelta(after.profit!.owed, owed.profit!.owed, "-200.00", "owed after the parcel came back");
      expectDelta(after.profit!.sold, owed.profit!.sold, "-200.00", "sold after the parcel came back");
    });
  });

  describe("what may be collected at all", () => {
    it("refuses to collect a cancelled sale and a fully returned one", async () => {
      const cancelled = await sell(admin, [{ productId: product.id, quantity: 1 }], { channel: "WHATSAPP" });
      await setStatus(admin, cancelled.id, "CANCELLED");

      const returned = await sellOnCredit(admin, [{ productId: product.id, quantity: 1 }]);
      await returnOrderRequest(admin, returned.id);

      for (const [what, id] of [
        ["a cancelled", cancelled.id],
        ["a fully returned", returned.id],
      ] as const) {
        const res = await collect(admin, [id]);
        expect(res.status, `${what} sale owes the shop nothing`).toBe(409);
        expect(res.error?.code).toBe("error.order.not_collectable");
      }
    });

    it("is idempotent: collecting twice changes nothing and is not an error", async () => {
      const order = await sellOnCredit(admin, [{ productId: product.id, quantity: 1 }]);

      const first = await collect(admin, [order.id]);
      expect(first.status).toBe(200);
      expectCount(first.data!.collectedIds.length, 1, "orders collected the first time");
      const collectedAt = (await readOrder(admin, order.id)).collectedAt;

      const second = await collect(admin, [order.id]);
      expect(second.status, "two people settling the same batch must not produce a failure").toBe(200);
      expectCount(second.data!.collectedIds.length, 0, "orders collected the second time");
      expectCount(second.data!.alreadyCollectedIds.length, 1, "orders already collected");

      expect((await readOrder(admin, order.id)).collectedAt, "and the original timestamp stands").toBe(collectedAt);
    });

    it("refuses the whole batch when one id in it is unknown", async () => {
      const order = await sellOnCredit(admin, [{ productId: product.id, quantity: 1 }]);

      const res = await collect(admin, [order.id, "does-not-exist"]);
      expect(res.status, "an unknown id fails the batch").toBe(404);

      expect(
        (await readOrder(admin, order.id)).paymentStatus,
        "and the good order in it must NOT have been settled"
      ).toBe("PENDING_COLLECTION");
    });
  });

  describe("settling a batch", () => {
    it("collects exactly the orders pending at that moment, and leaves later ones pending", async () => {
      // Three orders, all owed. Only these three — the shop's own outstanding
      // orders are never touched, because the batch is named explicitly.
      const batch = [];
      for (let index = 0; index < 3; index++) {
        batch.push(await sellOnCredit(admin, [{ productId: product.id, quantity: 1 }]));
      }
      const snapshot = batch.map((order) => order.id);

      // ...and one taken AFTER the snapshot was made.
      const afterwards = await sellOnCredit(admin, [{ productId: product.id, quantity: 1 }]);

      const settled = await collect(admin, snapshot);
      expect(settled.status).toBe(200);
      expectCount(settled.data!.collectedIds.length, 3, "orders settled in the batch");
      expect(settled.data!.collectedIds.sort(), "and exactly the three that were named").toEqual(snapshot.sort());

      for (const id of snapshot) {
        expect((await readOrder(admin, id)).paymentStatus, `order ${id} in the batch`).toBe("COLLECTED");
      }
      expect(
        (await readOrder(admin, afterwards.id)).paymentStatus,
        "an order created after the batch was drawn up stays pending"
      ).toBe("PENDING_COLLECTION");
    });

    it("keeps the outstanding list and its total in step with the reports", async () => {
      const beforeSummary = await apiRequest<CollectionSummaryDto>("/api/orders/collection-summary", {
        token: admin,
      });
      const beforeReport = await salesReport(admin);

      const order = await sellOnCredit(admin, [{ productId: product.id, quantity: 2 }]);

      const afterSummary = await apiRequest<CollectionSummaryDto>("/api/orders/collection-summary", {
        token: admin,
      });
      const afterReport = await salesReport(admin);

      expectDelta(afterSummary.data!.amount, beforeSummary.data!.amount, "200.00", "outstanding total");
      expectCountDelta(afterSummary.data!.orderCount, beforeSummary.data!.orderCount, 1, "outstanding order count");
      expectDelta(
        afterReport.totals.pendingCollectionAmount,
        beforeReport.totals.pendingCollectionAmount,
        "200.00",
        "pending amount on the report"
      );

      // The outstanding view must actually list it.
      const outstanding = await apiRequest<OrderSummaryDto[]>(
        "/api/orders?paymentStatus=PENDING_COLLECTION&collectableOnly=true&pageSize=100&sortBy=createdAt&sortDir=desc",
        { token: admin }
      );
      expect(
        outstanding.data?.some((entry) => entry.id === order.id),
        "the new order must appear in the outstanding list"
      ).toBe(true);

      // ...and stop listing it once it is settled.
      await collect(admin, [order.id]);
      const settledList = await apiRequest<OrderSummaryDto[]>(
        "/api/orders?paymentStatus=PENDING_COLLECTION&collectableOnly=true&pageSize=100",
        { token: admin }
      );
      expect(
        settledList.data?.some((entry) => entry.id === order.id),
        "and disappear from it once collected"
      ).toBe(false);
    });

    it("keeps a cancelled sale out of the outstanding list, though it was never collected", async () => {
      const before = await apiRequest<CollectionSummaryDto>("/api/orders/collection-summary", { token: admin });

      const order = await sell(admin, [{ productId: product.id, quantity: 1 }], { channel: "WHATSAPP" });
      const whileOwed = await apiRequest<CollectionSummaryDto>("/api/orders/collection-summary", { token: admin });
      expectDelta(whileOwed.data!.amount, before.data!.amount, "100.00", "outstanding total while the sale stands");

      await setStatus(admin, order.id, "CANCELLED");

      // Back exactly where it started: a cancelled sale owes nothing.
      const after = await apiRequest<CollectionSummaryDto>("/api/orders/collection-summary", { token: admin });
      expectDelta(after.data!.amount, before.data!.amount, "0.00", "outstanding total after a cancellation");

      const outstanding = await apiRequest<OrderSummaryDto[]>(
        "/api/orders?paymentStatus=PENDING_COLLECTION&collectableOnly=true&pageSize=100",
        { token: admin }
      );
      expect(
        outstanding.data?.some((entry) => entry.id === order.id),
        "a cancelled sale owes nothing, so it must not be chased"
      ).toBe(false);
    });
  });
});
