import { afterAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { createSellableProduct } from "@tests/support/orders";
import { createExpense, expenseCategoryId } from "@tests/support/cash";
import { approveExpense } from "@tests/support/changeRequests";
import {
  channelTotals,
  fetchSalesReport,
  fetchSalesSummary,
  num,
  salesReport,
  salesSummary,
  surroundingRange,
  totalsDelta,
} from "@tests/support/reports";
import type { OrderDto, ProductDto, SalesReport } from "@tests/types";
import { ERROR_CODES } from "@/constants";

// Sales & profit reporting (Phase 2). Two things are being proved here:
// that the money is right — profit computed from the SNAPSHOTTED unit price
// and cost, net of both discount levels and of returns, with cancelled
// orders left out — and that cost/profit never reach a role without
// product.viewCost (CLAUDE.md rule 19).
//
// Every assertion is a DELTA around a sale (see tests/support/reports.ts):
// the target API already holds other orders, so absolute totals are not a
// thing any test can assert.
describe("Reports", () => {
  const openedOrderIds: string[] = [];
  const openedProductIds: string[] = [];
  // Expenses move the net-profit figures other tests measure as deltas, so
  // the ones raised here are cleaned up like the orders are.
  const openedExpenseIds: string[] = [];

  async function createOrder(token: string, body: unknown) {
    const res = await apiRequest<OrderDto>("/api/orders", { method: "POST", token, body });
    if (res.data?.id) openedOrderIds.push(res.data.id);
    return res;
  }

  async function sellableProduct(token: string, options?: Parameters<typeof createSellableProduct>[1]) {
    const product = await createSellableProduct(token, options);
    openedProductIds.push(product.id);
    return product;
  }

  function topSeller(report: SalesReport, productId: string, list: "topByRevenue" | "topByQuantity" = "topByRevenue") {
    return report[list].find((entry) => entry.productId === productId);
  }

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    for (const id of openedOrderIds) {
      await apiRequest(`/api/orders/${id}`, { method: "DELETE", token: admin.token });
    }
    for (const id of openedProductIds) {
      await apiRequest(`/api/products/${id}`, { method: "DELETE", token: admin.token });
    }
    for (const id of openedExpenseIds) {
      await apiRequest(`/api/expenses/${id}`, { method: "DELETE", token: admin.token });
    }
  });

  // -------------------------------------------------------------------------
  // Profit math
  // -------------------------------------------------------------------------
  describe("profit math", () => {
    it("nets both discount levels out of revenue and profit", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", cost: "40", stock: 20 });

      const before = await salesReport(admin.token);

      // 2 × 100 = 200, less a 10% line discount = 180, less a fixed 30 off
      // the order = 150 taken. Cost is 2 × 40 = 80, so profit is 70.
      const order = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 2, discountType: "PERCENT", discountValue: "10" }],
        discountType: "AMOUNT",
        discountValue: "30",
      });
      expect(order.status).toBe(201);
      expect(order.data!.total).toBe("150.00");

      const delta = totalsDelta((await salesReport(admin.token)).totals, before.totals);

      expect(delta.orderCount).toBe(1);
      expect(delta.itemCount).toBe(2);
      expect(delta.revenue).toBeCloseTo(150, 2);
      expect(delta.cost).toBeCloseTo(80, 2);
      expect(delta.profit).toBeCloseTo(70, 2);
      // 200 asked, 150 taken.
      expect(delta.discountAmount).toBeCloseTo(50, 2);
    });

    it("subtracts returned quantities from revenue, cost and profit", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", cost: "40", stock: 20 });

      const before = await salesReport(admin.token);

      const order = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 4 }],
      });
      expect(order.status).toBe(201);

      const returned = await apiRequest(`/api/orders/${order.data!.id}/return`, {
        method: "POST",
        token: admin.token,
        body: { items: [{ orderItemId: order.data!.items[0].id, quantity: 1 }] },
      });
      expect(returned.status).toBe(200);

      const after = await salesReport(admin.token);
      const delta = totalsDelta(after.totals, before.totals);

      // 3 of the 4 stayed sold.
      expect(delta.itemCount).toBe(3);
      expect(delta.revenue).toBeCloseTo(300, 2);
      expect(delta.cost).toBeCloseTo(120, 2);
      expect(delta.profit).toBeCloseTo(180, 2);

      // The returned unit is reported separately, on top of being netted out.
      expect(after.returns.orderCount - before.returns.orderCount).toBe(1);
      expect(after.returns.itemCount - before.returns.itemCount).toBe(1);
      expect(num(after.returns.amount) - num(before.returns.amount)).toBeCloseTo(100, 2);
    });

    it("drops a fully returned order out of the figures entirely", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", cost: "40", stock: 20 });

      const before = await salesReport(admin.token);

      const order = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 2 }],
      });
      expect(order.status).toBe(201);

      // No `items` returns the whole order.
      const returned = await apiRequest<OrderDto>(`/api/orders/${order.data!.id}/return`, {
        method: "POST",
        token: admin.token,
        body: {},
      });
      expect(returned.status).toBe(200);
      expect(returned.data!.status).toBe("RETURNED");

      const delta = totalsDelta((await salesReport(admin.token)).totals, before.totals);

      expect(delta.orderCount).toBe(0);
      expect(delta.itemCount).toBe(0);
      expect(delta.revenue).toBeCloseTo(0, 2);
      expect(delta.cost).toBeCloseTo(0, 2);
      expect(delta.profit).toBeCloseTo(0, 2);
    });

    it("excludes a cancelled order", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", cost: "40", stock: 20 });

      const before = await salesReport(admin.token);

      const order = await createOrder(admin.token, {
        channel: "WHATSAPP",
        customerName: "تقرير",
        customerPhone: "+970599700700",
        items: [{ productId: product.id, quantity: 2 }],
      });
      expect(order.status).toBe(201);

      const cancelled = await apiRequest<OrderDto>(`/api/orders/${order.data!.id}/status`, {
        method: "PATCH",
        token: admin.token,
        body: { status: "CANCELLED" },
      });
      expect(cancelled.status).toBe(200);

      const delta = totalsDelta((await salesReport(admin.token)).totals, before.totals);

      expect(delta.orderCount).toBe(0);
      expect(delta.itemCount).toBe(0);
      expect(delta.revenue).toBeCloseTo(0, 2);
      expect(delta.cost).toBeCloseTo(0, 2);
      expect(delta.profit).toBeCloseTo(0, 2);
    });

    // spec.md "Price & cost snapshots": profit must use what was true at the
    // moment of sale, not what the product costs today.
    it("keeps using the price and cost snapshotted at sale time", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", cost: "40", stock: 20 });

      const before = await salesReport(admin.token);

      const order = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 1 }],
      });
      expect(order.status).toBe(201);

      const repriced = await apiRequest<ProductDto>(`/api/products/${product.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { basePrice: "500", cost: "450" },
      });
      expect(repriced.status).toBe(200);

      const delta = totalsDelta((await salesReport(admin.token)).totals, before.totals);

      expect(delta.revenue).toBeCloseTo(100, 2);
      expect(delta.cost).toBeCloseTo(40, 2);
      expect(delta.profit).toBeCloseTo(60, 2);
    });
  });

  // -------------------------------------------------------------------------
  // Sales vs. money actually in hand (spec.md "Payment collection"). Revenue
  // says what was sold; it is NOT what the shop holds, because a courier
  // order is paid for later.
  // -------------------------------------------------------------------------
  describe("collected vs pending revenue", () => {
    it("counts a counter sale as collected the moment it is rung up", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", cost: "40", stock: 20 });

      const before = await salesReport(admin.token);

      const order = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 2 }],
      });
      expect(order.status).toBe(201);

      const delta = totalsDelta((await salesReport(admin.token)).totals, before.totals);

      expect(delta.revenue).toBeCloseTo(200, 2);
      expect(delta.collectedRevenue).toBeCloseTo(200, 2);
      expect(delta.pendingCollectionAmount).toBeCloseTo(0, 2);
      expect(delta.pendingCollectionOrderCount).toBe(0);
    });

    it("holds a courier sale as pending until it is collected, without changing revenue", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", cost: "40", stock: 20 });

      const before = await salesReport(admin.token);

      const order = await createOrder(admin.token, {
        channel: "WHATSAPP",
        customerName: "تحصيل",
        customerPhone: "+970597200200",
        items: [{ productId: product.id, quantity: 3 }],
      });
      expect(order.status).toBe(201);

      const pending = totalsDelta((await salesReport(admin.token)).totals, before.totals);
      // Sold, but not a shekel of it is in the shop yet.
      expect(pending.revenue).toBeCloseTo(300, 2);
      expect(pending.collectedRevenue).toBeCloseTo(0, 2);
      expect(pending.pendingCollectionAmount).toBeCloseTo(300, 2);
      expect(pending.pendingCollectionOrderCount).toBe(1);
      // Profit is a sales figure and is unaffected by when the money lands.
      expect(pending.profit).toBeCloseTo(180, 2);

      const collected = await apiRequest("/api/orders/collect", {
        method: "POST",
        token: admin.token,
        body: { orderIds: [order.data!.id] },
      });
      expect(collected.status).toBe(200);

      const settled = totalsDelta((await salesReport(admin.token)).totals, before.totals);
      // Collecting moves money between the two columns; the sale itself is
      // unchanged.
      expect(settled.revenue).toBeCloseTo(300, 2);
      expect(settled.collectedRevenue).toBeCloseTo(300, 2);
      expect(settled.pendingCollectionAmount).toBeCloseTo(0, 2);
      expect(settled.pendingCollectionOrderCount).toBe(0);
    });

    it("always splits revenue into collected plus pending, with nothing lost between them", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "60", cost: "20", stock: 20 });

      await createOrder(admin.token, { channel: "STORE", items: [{ productId: product.id, quantity: 1 }] });
      await createOrder(admin.token, {
        channel: "WHATSAPP",
        customerName: "تحصيل",
        customerPhone: "+970597300300",
        items: [{ productId: product.id, quantity: 1 }],
      });

      const report = await salesReport(admin.token);
      for (const totals of [report.totals, ...report.byChannel]) {
        expect(num(totals.collectedRevenue) + num(totals.pendingCollectionAmount)).toBeCloseTo(
          num(totals.revenue),
          2
        );
      }

      const summary = await salesSummary(admin.token);
      for (const period of ["today", "week", "month"] as const) {
        expect(
          num(summary[period].totals.collectedRevenue) + num(summary[period].totals.pendingCollectionAmount)
        ).toBeCloseTo(num(summary[period].totals.revenue), 2);
      }
    });

    it("shows the collection split to a Manager on the dashboard — it is a sales figure, not a cost", async () => {
      const manager = await getSession("MANAGER");
      const summary = await salesSummary(manager.token);

      expect(summary.today.totals.collectedRevenue).toBeDefined();
      expect(summary.today.totals.pendingCollectionAmount).toBeDefined();
      expect(summary.today.totals.cost).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Sold vs. received vs. owed, gross vs. net (spec.md "Cash drawer &
  // expenses" -> Reporting). ADMIN ONLY: every figure here is derived from
  // cost.
  // -------------------------------------------------------------------------
  describe("the money states", () => {
    it("states sold, received and owed separately, and they always reconcile", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", cost: "40", stock: 20 });

      const before = await salesReport(admin.token);

      // One sale paid at the counter...
      await createOrder(admin.token, { channel: "STORE", items: [{ productId: product.id, quantity: 1 }] });
      // ...and one gone out with the courier, whose money the delivery
      // company is still holding.
      const owed = await createOrder(admin.token, {
        channel: "WHATSAPP",
        customerName: "مستحق",
        customerPhone: "+970597400400",
        items: [{ productId: product.id, quantity: 2 }],
      });
      expect(owed.status).toBe(201);

      const after = await salesReport(admin.token);
      const money = after.profit!;
      const was = before.profit!;

      expect(num(money.sold) - num(was.sold)).toBeCloseTo(300, 2);
      expect(num(money.received) - num(was.received)).toBeCloseTo(100, 2);
      expect(num(money.owed) - num(was.owed)).toBeCloseTo(200, 2);
      expect(money.owedOrderCount - was.owedOrderCount).toBe(1);

      // The three are one figure split, never three opinions.
      expect(num(money.received) + num(money.owed)).toBeCloseTo(num(money.sold), 2);
      expect(num(money.sold)).toBeCloseTo(num(after.totals.revenue), 2);
      expect(num(money.received)).toBeCloseTo(num(after.totals.collectedRevenue), 2);
      expect(num(money.owed)).toBeCloseTo(num(after.totals.pendingCollectionAmount), 2);
    });

    it("computes COGS and gross profit for all sales and for the received part alone", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", cost: "40", stock: 20 });

      const before = await salesReport(admin.token);

      // 1 collected at the counter, 2 still with the courier.
      await createOrder(admin.token, { channel: "STORE", items: [{ productId: product.id, quantity: 1 }] });
      await createOrder(admin.token, {
        channel: "WHATSAPP",
        customerName: "ربح",
        customerPhone: "+970597500500",
        items: [{ productId: product.id, quantity: 2 }],
      });

      const money = (await salesReport(admin.token)).profit!;
      const was = before.profit!;

      // Cost of goods sold: 3 pieces at 40. Received-only: the 1 at the till.
      expect(num(money.cogs) - num(was.cogs)).toBeCloseTo(120, 2);
      expect(num(money.receivedCogs) - num(was.receivedCogs)).toBeCloseTo(40, 2);
      // Gross = sales - COGS, on each side.
      expect(num(money.grossProfit) - num(was.grossProfit)).toBeCloseTo(180, 2);
      expect(num(money.receivedGrossProfit) - num(was.receivedGrossProfit)).toBeCloseTo(60, 2);

      // And the identities hold outright, not just as deltas.
      expect(num(money.grossProfit)).toBeCloseTo(num(money.sold) - num(money.cogs), 2);
      expect(num(money.receivedGrossProfit)).toBeCloseTo(num(money.received) - num(money.receivedCogs), 2);
      expect(num(money.netProfit)).toBeCloseTo(
        num(money.grossProfit) - num(money.expenses) - num(money.giftCost),
        2
      );
      expect(num(money.receivedNetProfit)).toBeCloseTo(
        num(money.receivedGrossProfit) - num(money.expenses) - num(money.giftCost),
        2
      );
    });

    it("takes an approved expense off the net profit but leaves gross alone", async () => {
      const admin = await getSession("ADMIN");
      const categoryId = await expenseCategoryId(admin.token);

      const before = (await salesReport(admin.token)).profit!;

      const recorded = await createExpense(admin.token, {
        categoryId,
        amount: "77",
        note: `Vitest report expense ${uniqueId()}`,
        // Non-cash on purpose: a bill paid by transfer is just as real a
        // cost, even though the drawer never held that money.
        paidInCash: false,
      });
      expect(recorded.status).toBe(201);
      openedExpenseIds.push(recorded.data!.id);

      const after = (await salesReport(admin.token)).profit!;

      expect(num(after.expenses) - num(before.expenses)).toBeCloseTo(77, 2);
      // Overheads are not cost of goods sold, so gross is untouched...
      expect(num(after.grossProfit) - num(before.grossProfit)).toBeCloseTo(0, 2);
      expect(num(after.cogs) - num(before.cogs)).toBeCloseTo(0, 2);
      // ...and both nets drop by it. A bill is owed whether or not the
      // delivery company has settled up yet.
      expect(num(after.netProfit) - num(before.netProfit)).toBeCloseTo(-77, 2);
      expect(num(after.receivedNetProfit) - num(before.receivedNetProfit)).toBeCloseTo(-77, 2);
    });

    it("ignores an expense that is still awaiting approval", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const categoryId = await expenseCategoryId(employee.token);

      const before = (await salesReport(admin.token)).profit!;

      const pending = await createExpense(employee.token, { categoryId, amount: "500" });
      expect(pending.data!.approvalStatus).toBe("PENDING");
      openedExpenseIds.push(pending.data!.id);

      const during = (await salesReport(admin.token)).profit!;
      expect(num(during.expenses) - num(before.expenses)).toBeCloseTo(0, 2);
      expect(num(during.netProfit) - num(before.netProfit)).toBeCloseTo(0, 2);

      // Signing it off is what makes it real money.
      await approveExpense(admin.token, pending.data!.id);

      const after = (await salesReport(admin.token)).profit!;
      expect(num(after.expenses) - num(before.expenses)).toBeCloseTo(500, 2);
      expect(num(after.netProfit) - num(before.netProfit)).toBeCloseTo(-500, 2);
    });
  });

  // -------------------------------------------------------------------------
  // Breakdowns
  // -------------------------------------------------------------------------
  describe("breakdowns", () => {
    it("attributes a counter sale to the STORE channel", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", cost: "40", stock: 20 });

      const before = await salesReport(admin.token);

      const order = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 2 }],
      });
      expect(order.status).toBe(201);

      const after = await salesReport(admin.token);
      const delta = totalsDelta(channelTotals(after, "STORE"), channelTotals(before, "STORE"));

      expect(delta.orderCount).toBe(1);
      expect(delta.revenue).toBeCloseTo(200, 2);
      expect(delta.profit).toBeCloseTo(120, 2);

      // Every channel is always listed, even the ones that sold nothing.
      expect(after.byChannel.map((entry) => entry.channel)).toEqual(["STORE", "WHATSAPP", "WEBSITE"]);
    });

    it("lists a sold product among the best sellers with its net quantity", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", cost: "40", stock: 20 });

      const order = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 3 }],
      });
      expect(order.status).toBe(201);

      const report = await salesReport(admin.token);
      const seller = topSeller(report, product.id);

      expect(seller).toBeDefined();
      expect(seller!.quantity).toBe(3);
      expect(num(seller!.revenue)).toBeCloseTo(300, 2);
      expect(num(seller!.profit)).toBeCloseTo(180, 2);
      // The same line is reachable from the by-quantity ranking too.
      expect(topSeller(report, product.id, "topByQuantity")).toBeDefined();
    });

    it("covers exactly the picked range, last day included", async () => {
      const admin = await getSession("ADMIN");
      const report = await salesReport(admin.token);
      const { from, to } = surroundingRange();

      expect(report.range.from).toBe(`${from}T00:00:00.000Z`);
      // `to` is exclusive: the picked last day counts in full.
      expect(new Date(report.range.to).getTime() - new Date(`${to}T00:00:00.000Z`).getTime()).toBe(24 * 60 * 60 * 1000);
    });
  });

  // -------------------------------------------------------------------------
  // Dashboard summary
  // -------------------------------------------------------------------------
  describe("sales summary", () => {
    it("adds a new sale to today, this week and this month", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", cost: "40", stock: 20 });

      const before = await salesSummary(admin.token);

      const order = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 1 }],
      });
      expect(order.status).toBe(201);

      const after = await salesSummary(admin.token);

      for (const period of ["today", "week", "month"] as const) {
        const delta = totalsDelta(after[period].totals, before[period].totals);
        expect(delta.orderCount).toBe(1);
        expect(delta.revenue).toBeCloseTo(100, 2);
        expect(delta.profit).toBeCloseTo(60, 2);

        // The dashboard reads its Today block and its period tabs from this
        // one response, so each period carries the money states too.
        expect(num(after[period].profit!.sold) - num(before[period].profit!.sold)).toBeCloseTo(100, 2);
        expect(num(after[period].profit!.received) - num(before[period].profit!.received)).toBeCloseTo(100, 2);
        expect(num(after[period].profit!.grossProfit) - num(before[period].profit!.grossProfit)).toBeCloseTo(60, 2);
      }
    });

    it("reports the average order value as revenue over orders", async () => {
      const admin = await getSession("ADMIN");
      const today = (await salesSummary(admin.token)).today.totals;

      const expected = today.orderCount === 0 ? 0 : num(today.revenue) / today.orderCount;
      expect(num(today.averageOrderValue)).toBeCloseTo(expected, 1);
    });
  });

  // -------------------------------------------------------------------------
  // Role gating — two separate gates, both enforced here rather than in the
  // UI, and the reason this suite exists at all:
  //
  //   * WHO REACHES A REPORT. /sales is report.view (ADMIN ONLY);
  //     /sales-summary is dashboard.view (Admin/Manager). An EMPLOYEE holds
  //     neither, so no sales figure of any kind reaches them — not a partial
  //     one, not a zeroed one, a 403.
  //   * WHAT A REPORT CONTAINS. Cost, COGS, profit and margin are ADMIN ONLY
  //     (product.viewCost, CLAUDE.md rule 19). A Manager runs the shop floor,
  //     but the owner's margin is not theirs to read, so their summary must
  //     not CONTAIN those fields — absent, never zeroed.
  // -------------------------------------------------------------------------
  describe("role gating", () => {
    it("refuses the reports page to an Employee outright", async () => {
      const employee = await getSession("EMPLOYEE");

      const report = await fetchSalesReport(employee.token);
      expect(report.status).toBe(403);
      expect(report.error?.code).toBe(ERROR_CODES.FORBIDDEN);
      expect(report.data).toBeUndefined();

      // ...and the dashboard's block too: an Employee has no business
      // reading the shop's takings from either screen.
      const summary = await fetchSalesSummary(employee.token);
      expect(summary.status).toBe(403);
      expect(summary.error?.code).toBe(ERROR_CODES.FORBIDDEN);
      expect(summary.data).toBeUndefined();
    });

    it("refuses the reports page to a Manager — sales, cost and profit alike", async () => {
      const manager = await getSession("MANAGER");

      const report = await fetchSalesReport(manager.token);
      expect(report.status).toBe(403);
      expect(report.error?.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it("returns no cost, profit or margin to a Manager on the dashboard", async () => {
      const manager = await getSession("MANAGER");

      const summary = await salesSummary(manager.token);
      for (const period of ["today", "week", "month"] as const) {
        expect(summary[period].totals.revenue).toBeDefined();
        expect(summary[period].totals.cost).toBeUndefined();
        expect(summary[period].totals.profit).toBeUndefined();
        expect(summary[period].totals.margin).toBeUndefined();
        expect(summary[period].totals.missingCostItems).toBeUndefined();
        // ...and no money-states block at all, so the dashboard has no
        // empty profit cards to render.
        expect(summary[period].profit).toBeUndefined();
      }

      // Nothing cost-shaped anywhere in the payload, however nested.
      const raw = JSON.stringify(summary);
      expect(raw).not.toContain("cost");
      expect(raw).not.toContain("profit");
      expect(raw).not.toContain("margin");
    });

    it("returns cost, profit and margin to an Admin", async () => {
      const admin = await getSession("ADMIN");
      const report = await salesReport(admin.token);

      expect(report.totals.cost).toBeDefined();
      expect(report.totals.profit).toBeDefined();
      expect(report.totals.missingCostItems).toBeDefined();
      expect(report.profit).toBeDefined();

      for (const channel of report.byChannel) {
        expect(channel.cost).toBeDefined();
      }
      for (const seller of [...report.topByRevenue, ...report.topByQuantity]) {
        expect(seller.profit).toBeDefined();
      }
    });

    it("refuses an unauthenticated caller", async () => {
      const summary = await fetchSalesSummary("");
      expect(summary.status).toBe(401);
      expect(summary.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);

      const report = await fetchSalesReport("");
      expect(report.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // Range validation
  // -------------------------------------------------------------------------
  describe("range validation", () => {
    it("rejects a range that ends before it starts", async () => {
      const admin = await getSession("ADMIN");
      const res = await apiRequest("/api/reports/sales?from=2026-08-04&to=2026-08-01", { token: admin.token });

      expect(res.status).toBe(400);
      expect(res.error?.code).toBe(ERROR_CODES.VALIDATION);
    });

    it("rejects a range longer than a year", async () => {
      const admin = await getSession("ADMIN");
      const res = await apiRequest("/api/reports/sales?from=2020-01-01&to=2026-01-01", { token: admin.token });

      expect(res.status).toBe(400);
      expect(res.error?.code).toBe(ERROR_CODES.VALIDATION);
    });

    it("rejects a malformed date", async () => {
      const admin = await getSession("ADMIN");
      const res = await apiRequest("/api/reports/sales?from=04-08-2026&to=2026-08-04", { token: admin.token });

      expect(res.status).toBe(400);
      expect(res.error?.code).toBe(ERROR_CODES.VALIDATION);
    });
  });
});
