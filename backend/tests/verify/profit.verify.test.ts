// ============================================================================
//  7. PROFIT
//
//      gross = sales − COGS
//      net   = gross − approved expenses − gifts at cost
//
//  ...each given twice: for everything sold, and for the part that has
//  actually been paid for. A good month and a month that has been paid for
//  are different months.
//
//    * both profits are computed from the unitPrice/unitCost SNAPSHOTTED at
//      sale time — re-pricing or re-costing the product afterwards must not
//      move a single historical figure (spec.md "Price & cost snapshots");
//    * a cancelled order is out entirely, a return comes off both sides;
//    * a gift adds nothing to sales and its COST is subtracted as overhead;
//    * a line sold with no cost recorded counts as zero and is surfaced as
//      missingCostItems, because it quietly makes both profits look better.
// ============================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { expectCountDelta, expectDelta, expectMoney, expectSum } from "@tests/support/money";
import { salesReport } from "@tests/support/reports";
import { createExpense, expenseCategoryId } from "@tests/support/cash";
import {
  collect,
  createPricedProduct,
  returnOrderRequest,
  sell,
  sellOnCredit,
  setStatus,
} from "@tests/support/verify";
import { UNIT_COST, UNIT_PRICE } from "@tests/constants";
import type { PricedProduct, SalesReport } from "@tests/types";

// gross on one unit of the standard fixture: 100.00 sold, 40.00 bought in.
const UNIT_GROSS = "60.00";

describe("Verify · profit", () => {
  let admin: string;
  let product: PricedProduct;
  let category: string;

  beforeAll(async () => {
    admin = (await getSession("ADMIN")).token;
    category = await expenseCategoryId(admin);
    product = await createPricedProduct(admin, { basePrice: UNIT_PRICE, cost: UNIT_COST, stock: 200 });
  });

  function profit(report: SalesReport) {
    if (!report.profit) throw new Error("The Admin's report must carry the profit block.");
    return report.profit;
  }

  describe("gross and net, on all sales and on the received part", () => {
    it("computes gross on a counter sale: 2 x (100.00 − 40.00) = 120.00, received in full", async () => {
      const before = await salesReport(admin);
      await sell(admin, [{ productId: product.id, quantity: 2 }]);
      const after = await salesReport(admin);

      expectDelta(profit(after).sold, profit(before).sold, "200.00", "sold");
      expectDelta(profit(after).cogs, profit(before).cogs, "80.00", "COGS");
      expectDelta(profit(after).grossProfit, profit(before).grossProfit, "120.00", "gross profit");

      // Paid on the spot, so the received figures move by exactly the same.
      expectDelta(profit(after).received, profit(before).received, "200.00", "received");
      expectDelta(profit(after).receivedCogs, profit(before).receivedCogs, "80.00", "COGS on the received part");
      expectDelta(
        profit(after).receivedGrossProfit,
        profit(before).receivedGrossProfit,
        "120.00",
        "gross profit on the received part"
      );
    });

    it("counts a courier sale's gross profit but not its RECEIVED gross, until it is collected", async () => {
      const before = await salesReport(admin);
      const order = await sellOnCredit(admin, [{ productId: product.id, quantity: 1 }]);
      const owed = await salesReport(admin);

      expectDelta(profit(owed).grossProfit, profit(before).grossProfit, UNIT_GROSS, "gross profit on all sales");
      expectDelta(
        profit(owed).receivedGrossProfit,
        profit(before).receivedGrossProfit,
        "0.00",
        "gross profit on the received part (nothing has been received)"
      );
      expectDelta(profit(owed).receivedCogs, profit(before).receivedCogs, "0.00", "COGS on the received part");

      await collect(admin, [order.id]);
      const received = await salesReport(admin);

      expectDelta(
        profit(received).receivedGrossProfit,
        profit(owed).receivedGrossProfit,
        UNIT_GROSS,
        "gross profit on the received part, once it was paid for"
      );
      expectDelta(
        profit(received).grossProfit,
        profit(owed).grossProfit,
        "0.00",
        "gross profit on all sales (unchanged — being paid is not a sale)"
      );
    });

    it("holds the identities: gross = sold − COGS, net = gross − overheads", async () => {
      await sell(admin, [{ productId: product.id, quantity: 1 }]);
      const report = profit(await salesReport(admin));

      expectSum([report.grossProfit, report.cogs], report.sold, "sold = gross profit + COGS");
      expectSum([report.netProfit, report.overheads], report.grossProfit, "gross profit = net profit + overheads");
      expectSum([report.expenses, report.giftCost], report.overheads, "overheads = expenses + gifts at cost");
      expectSum(
        [report.receivedGrossProfit, report.receivedCogs],
        report.received,
        "received = received gross profit + received COGS"
      );
      expectSum(
        [report.receivedNetProfit, report.overheads],
        report.receivedGrossProfit,
        "received gross profit = received net profit + overheads"
      );
    });
  });

  describe("what comes off the net", () => {
    it("subtracts an approved expense from BOTH nets and leaves gross untouched", async () => {
      const before = await salesReport(admin);

      const spent = await createExpense(admin, {
        categoryId: category,
        amount: "30.00",
        paidInCash: true,
        note: "[verify] an approved expense",
      });
      expect(spent.status).toBe(201);
      expect(spent.data!.approvalStatus, "an Admin's own expense counts immediately").toBe("APPROVED");

      const after = await salesReport(admin);
      expectDelta(profit(after).expenses, profit(before).expenses, "30.00", "expenses");
      expectDelta(profit(after).grossProfit, profit(before).grossProfit, "0.00", "gross profit (a bill is not COGS)");
      expectDelta(profit(after).netProfit, profit(before).netProfit, "-30.00", "net profit");
      // A bill is owed whether or not the delivery company has settled up.
      expectDelta(
        profit(after).receivedNetProfit,
        profit(before).receivedNetProfit,
        "-30.00",
        "net profit on the received part"
      );
    });

    it("ignores an expense that is still waiting for approval", async () => {
      const employee = (await getSession("EMPLOYEE")).token;
      const before = await salesReport(admin);

      const pending = await createExpense(employee, {
        categoryId: category,
        amount: "77.00",
        paidInCash: true,
        note: "[verify] an unapproved expense",
      });
      expect(pending.data!.approvalStatus).toBe("PENDING");

      const after = await salesReport(admin);
      expectDelta(profit(after).expenses, profit(before).expenses, "0.00", "expenses (nothing was agreed to)");
      expectDelta(profit(after).netProfit, profit(before).netProfit, "0.00", "net profit");
    });

    it("keeps a gift out of sales and subtracts what it cost the shop", async () => {
      const before = await salesReport(admin);
      const given = await sell(admin, [{ productId: product.id, quantity: 2 }], { type: "GIFT" });

      expectMoney(given.total, "0.00", "a gift charges nothing");
      expectMoney(given.items[0].unitPrice, "0.00", "and every line is priced at zero, not discounted 100%");
      expectMoney(given.items[0].unitCost, UNIT_COST, "but what it cost the shop survives on the line");
      expectMoney(given.items[0].discountAmount, "0.00", "a gift is not a discount");

      const after = await salesReport(admin);
      expectDelta(profit(after).sold, profit(before).sold, "0.00", "sold (a gift earned nothing)");
      expectDelta(profit(after).cogs, profit(before).cogs, "0.00", "COGS (a gift is not a cost of goods SOLD)");
      expectDelta(profit(after).giftCost, profit(before).giftCost, "80.00", "gifts at cost (2 x 40.00)");
      expectDelta(profit(after).grossProfit, profit(before).grossProfit, "0.00", "gross profit");
      expectDelta(profit(after).netProfit, profit(before).netProfit, "-80.00", "net profit");
    });
  });

  describe("the snapshot is the truth (spec.md 'Price & cost snapshots')", () => {
    it("does not move a single historical figure when the product is re-priced and re-costed", async () => {
      // Its own product, so nothing else in the window can move underneath it.
      const item = await createPricedProduct(admin, { basePrice: UNIT_PRICE, cost: UNIT_COST, stock: 10 });

      const before = await salesReport(admin);
      await sell(admin, [{ productId: item.id, quantity: 3 }]);
      const afterSale = await salesReport(admin);

      const soldMoved = "300.00";
      const cogsMoved = "120.00";
      expectDelta(profit(afterSale).sold, profit(before).sold, soldMoved, "sold");
      expectDelta(profit(afterSale).cogs, profit(before).cogs, cogsMoved, "COGS");
      expectDelta(profit(afterSale).grossProfit, profit(before).grossProfit, "180.00", "gross profit");

      // Now the shop re-prices and re-costs the piece — more than doubling both.
      const repriced = await apiRequest(`/api/products/${item.id}`, {
        method: "PATCH",
        token: admin,
        body: { basePrice: "250.00", cost: "220.00" },
      });
      expect(repriced.status, "an Admin may re-price and re-cost a product").toBe(200);

      const afterRepricing = await salesReport(admin);
      // Every figure must be EXACTLY where it was — not merely close.
      expectMoney(profit(afterRepricing).sold, profit(afterSale).sold, "sold after re-pricing");
      expectMoney(profit(afterRepricing).cogs, profit(afterSale).cogs, "COGS after re-costing");
      expectMoney(profit(afterRepricing).grossProfit, profit(afterSale).grossProfit, "gross profit after re-costing");
      expectMoney(profit(afterRepricing).netProfit, profit(afterSale).netProfit, "net profit after re-costing");
      expectMoney(
        profit(afterRepricing).receivedGrossProfit,
        profit(afterSale).receivedGrossProfit,
        "received gross profit after re-costing"
      );

      // ...and so must the line it came from.
      const top = afterRepricing.topByRevenue.find((seller) => seller.productId === item.id);
      if (top) expectMoney(top.revenue, "300.00", "the product's revenue among the best sellers");
    });
  });

  describe("what is left out and what is flagged", () => {
    it("excludes a cancelled order from every profit figure", async () => {
      const order = await sell(admin, [{ productId: product.id, quantity: 2 }], { channel: "WHATSAPP" });
      await setStatus(admin, order.id, "PREPARING");
      const sold = await salesReport(admin);

      await setStatus(admin, order.id, "CANCELLED");
      const after = await salesReport(admin);

      expectDelta(profit(after).sold, profit(sold).sold, "-200.00", "sold");
      expectDelta(profit(after).cogs, profit(sold).cogs, "-80.00", "COGS");
      expectDelta(profit(after).grossProfit, profit(sold).grossProfit, "-120.00", "gross profit");
    });

    it("takes a returned unit off both the revenue and the COGS side", async () => {
      const before = await salesReport(admin);
      const order = await sell(admin, [{ productId: product.id, quantity: 3 }]);
      const afterSale = await salesReport(admin);

      await returnOrderRequest(admin, order.id, [{ orderItemId: order.items[0].id, quantity: 1 }]);
      const afterReturn = await salesReport(admin);

      expectDelta(profit(afterReturn).sold, profit(afterSale).sold, "-100.00", "sold after one unit came back");
      expectDelta(profit(afterReturn).cogs, profit(afterSale).cogs, "-40.00", "COGS after one unit came back");
      expectDelta(
        profit(afterReturn).grossProfit,
        profit(afterSale).grossProfit,
        "-60.00",
        "gross profit after one unit came back"
      );
      // Net of everything: 2 units still sold.
      expectDelta(profit(afterReturn).sold, profit(before).sold, "200.00", "sold, net of the return");
      expectDelta(profit(afterReturn).grossProfit, profit(before).grossProfit, "120.00", "gross profit, net of the return");
    });

    it("counts a costless line as zero COGS and flags it as missingCostItems", async () => {
      const costless = await createPricedProduct(admin, { basePrice: UNIT_PRICE, cost: null, stock: 5 });

      const before = await salesReport(admin);
      const order = await sell(admin, [{ productId: costless.id, quantity: 1 }]);
      expect(order.items[0].unitCost, "there was no cost to snapshot").toBeNull();

      const after = await salesReport(admin);
      expectDelta(profit(after).sold, profit(before).sold, "100.00", "sold");
      expectDelta(profit(after).cogs, profit(before).cogs, "0.00", "COGS (nothing was recorded)");
      expectDelta(profit(after).grossProfit, profit(before).grossProfit, "100.00", "gross profit (flattered by the gap)");
      expectCountDelta(
        profit(after).missingCostItems,
        profit(before).missingCostItems,
        1,
        "lines flagged as having no cost"
      );
    });
  });
});
