import { afterAll, describe, expect, it } from "vitest";
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { createSellableProduct } from "@tests/support/orders";
import { num, surroundingRange } from "@tests/support/reports";
import type { OrderDto, SalesPeriod, TopSeller } from "@tests/types";
import { ERROR_CODES, MAX_PAGE_SIZE } from "@/constants";

// The Sales log: the period headline and every piece sold, gated on sales.view, cost absent below product.viewCost.
describe("Sales log", () => {
  const openedOrderIds: string[] = [];
  const openedProductIds: string[] = [];
  const { from, to } = surroundingRange();
  const rangeQuery = `from=${from}&to=${to}&tzOffset=0`;

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    for (const id of openedOrderIds) {
      await apiRequest(`/api/orders/${id}`, { method: "DELETE", token: admin.token });
    }
    for (const id of openedProductIds) {
      await apiRequest(`/api/products/${id}`, { method: "DELETE", token: admin.token });
    }
  });

  async function period(token: string) {
    return apiRequest<SalesPeriod>(`/api/reports/period?${rangeQuery}`, { token });
  }

  // Walks every page, so the assertion never depends on how much else sold in the window.
  async function allSoldItems(token: string): Promise<TopSeller[]> {
    const items: TopSeller[] = [];
    for (let page = 1; ; page += 1) {
      const res = await apiRequest<TopSeller[]>(
        `/api/reports/sold-items?${rangeQuery}&page=${page}&pageSize=${MAX_PAGE_SIZE}`,
        { token },
      );
      expect(res.status).toBe(200);
      items.push(...res.data!);
      if (page >= res.meta!.totalPages) {
        return items;
      }
    }
  }

  it("lists a sold product with its quantity and moves the period's totals", async () => {
    const admin = await getSession("ADMIN");
    const product = await createSellableProduct(admin.token, { basePrice: "50", cost: "20", stock: 10 });
    openedProductIds.push(product.id);
    const before = (await period(admin.token)).data!;

    const order = await apiRequest<OrderDto>("/api/orders", {
      method: "POST",
      token: admin.token,
      body: { channel: "STORE", items: [{ productId: product.id, quantity: 3 }] },
    });
    expect(order.status).toBe(201);
    openedOrderIds.push(order.data!.id);

    const after = (await period(admin.token)).data!;
    expect(after.totals.itemCount - before.totals.itemCount).toBe(3);
    expect(num(after.totals.revenue) - num(before.totals.revenue)).toBeCloseTo(150, 2);

    const line = (await allSoldItems(admin.token)).find((item) => item.productId === product.id);
    expect(line?.quantity).toBe(3);
    expect(line?.revenue).toBe("150.00");
    expect(line?.profit).toBe("90.00");
  });

  it("pages within the requested size and reports the total", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<TopSeller[]>(`/api/reports/sold-items?${rangeQuery}&pageSize=1&sortBy=revenue`, {
      token: admin.token,
    });
    expect(res.status).toBe(200);
    expect(res.data!.length).toBeLessThanOrEqual(1);
    expect(res.meta).toMatchObject({ page: 1, pageSize: 1 });
    expect(res.meta!.totalPages).toBe(Math.max(1, res.meta!.total));
  });

  it("gives a Manager the figures without cost or profit", async () => {
    const manager = await getSession("MANAGER");
    const totals = await period(manager.token);
    expect(totals.status).toBe(200);
    expect(totals.data!.totals).not.toHaveProperty("cost");
    expect(totals.data!.totals).not.toHaveProperty("profit");

    const items = await allSoldItems(manager.token);
    for (const item of items) {
      expect(item).not.toHaveProperty("profit");
    }
  });

  it("refuses an Employee both endpoints", async () => {
    const employee = await getSession("EMPLOYEE");
    expect((await period(employee.token)).status).toBe(403);
    const items = await apiRequest(`/api/reports/sold-items?${rangeQuery}`, { token: employee.token });
    expect(items.status).toBe(403);
  });

  it("rejects a range that runs backwards", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest(`/api/reports/sold-items?from=${to}&to=${from}&tzOffset=0`, { token: admin.token });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.error)).toContain(ERROR_CODES.REPORT_RANGE_INVALID);
  });
});
