import { afterAll, describe, expect, it } from "vitest";
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { createSellableProduct } from "@tests/support/orders";
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

    it("buckets the trend series by day for a short range", async () => {
      const admin = await getSession("ADMIN");
      const report = await salesReport(admin.token);
      const { from, to } = surroundingRange();

      expect(report.granularity).toBe("day");
      expect(report.range.from).toBe(`${from}T00:00:00.000Z`);
      // `to` is exclusive: the picked last day counts in full.
      expect(new Date(report.range.to).getTime() - new Date(`${to}T00:00:00.000Z`).getTime()).toBe(24 * 60 * 60 * 1000);
      for (const point of report.series) {
        expect(point.date >= from).toBe(true);
        expect(point.date <= to).toBe(true);
      }
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
        const delta = totalsDelta(after[period], before[period]);
        expect(delta.orderCount).toBe(1);
        expect(delta.revenue).toBeCloseTo(100, 2);
        expect(delta.profit).toBeCloseTo(60, 2);
      }
    });

    it("reports the average order value as revenue over orders", async () => {
      const admin = await getSession("ADMIN");
      const today = (await salesSummary(admin.token)).today;

      const expected = today.orderCount === 0 ? 0 : num(today.revenue) / today.orderCount;
      expect(num(today.averageOrderValue)).toBeCloseTo(expected, 1);
    });
  });

  // -------------------------------------------------------------------------
  // Role gating (CLAUDE.md rule 19) — the whole point of doing this on the
  // backend: an Employee's response must not CONTAIN cost or profit.
  // -------------------------------------------------------------------------
  describe("role gating", () => {
    it("returns no cost, profit or margin to an Employee", async () => {
      const employee = await getSession("EMPLOYEE");

      const summary = await salesSummary(employee.token);
      for (const period of ["today", "week", "month"] as const) {
        expect(summary[period].revenue).toBeDefined();
        expect(summary[period].cost).toBeUndefined();
        expect(summary[period].profit).toBeUndefined();
        expect(summary[period].margin).toBeUndefined();
        expect(summary[period].missingCostItems).toBeUndefined();
      }

      const report = await salesReport(employee.token);
      expect(report.totals.revenue).toBeDefined();
      expect(report.totals.cost).toBeUndefined();
      expect(report.totals.profit).toBeUndefined();
      expect(report.totals.margin).toBeUndefined();

      for (const channel of report.byChannel) {
        expect(channel.cost).toBeUndefined();
        expect(channel.profit).toBeUndefined();
      }
      for (const point of report.series) {
        expect(point.profit).toBeUndefined();
      }
      for (const seller of [...report.topByRevenue, ...report.topByQuantity]) {
        expect(seller.profit).toBeUndefined();
      }

      // Nothing cost-shaped anywhere in the payload, however nested.
      const raw = JSON.stringify(report);
      expect(raw).not.toContain("cost");
      expect(raw).not.toContain("profit");
      expect(raw).not.toContain("margin");
    });

    it("returns cost, profit and margin to a Manager", async () => {
      const manager = await getSession("MANAGER");
      const report = await salesReport(manager.token);

      expect(report.totals.cost).toBeDefined();
      expect(report.totals.profit).toBeDefined();
      expect(report.totals.missingCostItems).toBeDefined();
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
