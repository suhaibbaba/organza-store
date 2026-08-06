import { afterAll, describe, expect, it } from "vitest";
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { createSellableProduct, readStock } from "@tests/support/orders";
import { num, salesReport } from "@tests/support/reports";
import { ERROR_CODES } from "@/constants";
import type { OrderDto } from "@tests/types";

// Gift orders (spec.md "Cash drawer & expenses" -> Gifts).
//
// A gift is stock walking out of the shop for nothing. It goes through the
// same machinery as a counter sale — same lines, same stock deduction, same
// audit trail — but charges nothing, and the two claims that matter are:
//   * it DEDUCTS STOCK, exactly like a sale;
//   * it is EXCLUDED FROM SALES, and what it cost is subtracted as a cost of
//     doing business instead.
describe("Gift orders", () => {
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
  // What a gift is
  // -------------------------------------------------------------------------
  describe("giving stock away", () => {
    it("deducts stock and charges nothing", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "180", cost: "70", stock: 6 });

      const res = await createOrder(admin.token, {
        channel: "STORE",
        type: "GIFT",
        items: [{ productId: product.id, quantity: 2 }],
        note: "هدية لعروس",
      });

      expect(res.status).toBe(201);
      expect(res.data!.type).toBe("GIFT");
      // Same path as a counter sale: it opens finished, with the goods gone.
      expect(res.data!.status).toBe("COMPLETED");
      expect(res.data!.stockDeductedAt).not.toBeNull();
      expect(await readStock(admin.token, product.id)).toBe(4);

      // Priced at zero, NOT discounted to zero: a discounted line is a sale
      // that earned less; a gift earned nothing.
      expect(num(res.data!.total)).toBe(0);
      expect(num(res.data!.subtotal)).toBe(0);
      expect(num(res.data!.discountAmount)).toBe(0);
      expect(res.data!.discountType).toBeNull();
      expect(num(res.data!.items[0].unitPrice)).toBe(0);
      expect(num(res.data!.items[0].lineTotal)).toBe(0);
      // ...but what the shop LOST is kept, because that is the whole figure
      // a gift is reported at.
      expect(num(res.data!.items[0].unitCost)).toBe(70);

      // Nothing is owed on it, so it never joins the outstanding list.
      expect(res.data!.paymentStatus).toBe("COLLECTED");
    });

    it("ignores a discount sent alongside a gift", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", stock: 3 });

      const res = await createOrder(admin.token, {
        channel: "STORE",
        type: "GIFT",
        items: [{ productId: product.id, quantity: 1, discountType: "PERCENT", discountValue: "50" }],
        discountType: "AMOUNT",
        discountValue: "10",
      });

      // A discount off nothing is nothing — it is dropped, not applied to a
      // zero subtotal.
      expect(res.status).toBe(201);
      expect(num(res.data!.total)).toBe(0);
      expect(res.data!.discountType).toBeNull();
      expect(res.data!.items[0].discountType).toBeNull();
    });

    it("stays out of an ordinary sale's way — a normal order is still a SALE", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "50", stock: 3 });

      const res = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 1 }],
      });
      expect(res.data!.type).toBe("SALE");
      expect(num(res.data!.total)).toBe(50);
    });

    it("can be filtered for, and filtered out, on the orders list", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "20", stock: 3 });

      const gift = await createOrder(admin.token, {
        channel: "STORE",
        type: "GIFT",
        items: [{ productId: product.id, quantity: 1 }],
      });

      const gifts = await apiRequest<{ id: string; type: string }[]>("/api/orders?type=GIFT&pageSize=100", {
        token: admin.token,
      });
      expect(gifts.data!.some((order) => order.id === gift.data!.id)).toBe(true);
      for (const order of gifts.data!) expect(order.type).toBe("GIFT");

      const sales = await apiRequest<{ id: string }[]>("/api/orders?type=SALE&pageSize=100", {
        token: admin.token,
      });
      expect(sales.data!.some((order) => order.id === gift.data!.id)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Who may give stock away
  // -------------------------------------------------------------------------
  describe("role gating", () => {
    it("refuses an Employee — filing a sale as a gift is how a piece walks out", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const product = await sellableProduct(admin.token, { basePrice: "40", stock: 3 });

      const res = await createOrder(employee.token, {
        channel: "STORE",
        type: "GIFT",
        items: [{ productId: product.id, quantity: 1 }],
      });
      expect(res.status).toBe(403);
      expect(res.error?.code).toBe(ERROR_CODES.FORBIDDEN);

      // ...and no stock moved.
      expect(await readStock(admin.token, product.id)).toBe(3);

      // The same Employee may still ring the piece up as an ordinary sale.
      const sale = await createOrder(employee.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 1 }],
      });
      expect(sale.status).toBe(201);
    });

    it("lets a Manager give stock away", async () => {
      const admin = await getSession("ADMIN");
      const manager = await getSession("MANAGER");
      const product = await sellableProduct(admin.token, { basePrice: "40", stock: 3 });

      const res = await createOrder(manager.token, {
        channel: "STORE",
        type: "GIFT",
        items: [{ productId: product.id, quantity: 1 }],
      });
      expect(res.status).toBe(201);
      expect(res.data!.type).toBe("GIFT");
      // A Manager may give it away but still may not see what it cost.
      expect(res.data!.items[0]).not.toHaveProperty("unitCost");
    });

    it("refuses a gift on any channel but the counter", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "40", stock: 3 });

      const res = await createOrder(admin.token, {
        channel: "WHATSAPP",
        type: "GIFT",
        customerName: "سارة",
        customerPhone: "+970599777111",
        items: [{ productId: product.id, quantity: 1 }],
      });
      expect(res.status).toBe(400);
      expect(res.error?.code).toBe(ERROR_CODES.VALIDATION);
    });
  });

  // -------------------------------------------------------------------------
  // How a gift lands in the books
  // -------------------------------------------------------------------------
  describe("reporting", () => {
    it("adds nothing to sales, and its cost to what the shop spent", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "200", cost: "65", stock: 10 });

      const before = await salesReport(admin.token);

      const gift = await createOrder(admin.token, {
        channel: "STORE",
        type: "GIFT",
        items: [{ productId: product.id, quantity: 2 }],
      });
      expect(gift.status).toBe(201);

      const after = await salesReport(admin.token);

      // Excluded from sales ENTIRELY — not counted at zero revenue, which
      // would still drag the order count and the average order value.
      expect(num(after.totals.revenue) - num(before.totals.revenue)).toBeCloseTo(0, 2);
      expect(after.totals.orderCount - before.totals.orderCount).toBe(0);
      expect(after.totals.itemCount - before.totals.itemCount).toBe(0);
      // ...and not as cost of goods SOLD either: nothing was sold.
      expect(num(after.totals.cost) - num(before.totals.cost)).toBeCloseTo(0, 2);

      const storeBefore = before.byChannel.find((entry) => entry.channel === "STORE")!;
      const storeAfter = after.byChannel.find((entry) => entry.channel === "STORE")!;
      expect(storeAfter.orderCount - storeBefore.orderCount).toBe(0);

      // What it cost the shop shows up as a cost of doing business, and
      // takes exactly that much off the net profit.
      expect(num(after.profit!.giftCost) - num(before.profit!.giftCost)).toBeCloseTo(130, 2);
      expect(num(after.profit!.cogs) - num(before.profit!.cogs)).toBeCloseTo(0, 2);
      expect(num(after.profit!.grossProfit) - num(before.profit!.grossProfit)).toBeCloseTo(0, 2);
      expect(num(after.profit!.netProfit) - num(before.profit!.netProfit)).toBeCloseTo(-130, 2);
      expect(num(after.profit!.receivedNetProfit) - num(before.profit!.receivedNetProfit)).toBeCloseTo(-130, 2);
    });
  });
});
