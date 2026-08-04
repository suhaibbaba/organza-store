import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { createSellableProduct, readStock } from "@tests/support/orders";
import type { OrderDto, OrderSummaryDto } from "@tests/types";
import { ERROR_CODES } from "@/constants";

// Orders (Phase 2). Every assertion here runs against the live API, so each
// block creates its own product and cleans up the orders it opened — the
// suite must be re-runnable against a shared sandbox.
describe("Orders", () => {
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
  // Creation — the two shapes of sale
  // -------------------------------------------------------------------------
  describe("creation", () => {
    it("opens a STORE order as completed, with stock already deducted", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", stock: 10 });

      const res = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 2 }],
      });

      expect(res.status).toBe(201);
      expect(res.data!.status).toBe("COMPLETED");
      expect(res.data!.stockDeductedAt).not.toBeNull();
      expect(res.data!.total).toBe("200.00");
      expect(await readStock(admin.token, product.id)).toBe(8);
    });

    it("opens an online order as NEW, holding no stock yet", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", stock: 10 });

      const res = await createOrder(admin.token, {
        channel: "WHATSAPP",
        customerName: "سعاد",
        customerPhone: "+970599100100",
        items: [{ productId: product.id, quantity: 3 }],
      });

      expect(res.status).toBe(201);
      expect(res.data!.status).toBe("NEW");
      // An unanswered WhatsApp order must not hold an item off the shelf.
      expect(res.data!.stockDeductedAt).toBeNull();
      expect(await readStock(admin.token, product.id)).toBe(10);
    });

    it("requires customer details for an online order but not for a STORE sale", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { stock: 5 });

      const online = await createOrder(admin.token, {
        channel: "WEBSITE",
        items: [{ productId: product.id, quantity: 1 }],
      });
      expect(online.status).toBe(400);
      expect(online.error?.code).toBe(ERROR_CODES.VALIDATION);

      const store = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 1 }],
      });
      expect(store.status).toBe(201);
      expect(store.data!.customerName).toBeNull();
    });

    // spec.md "Customer information": customers are still deferred as an
    // entity, so the address — and an optional map pin for places with no
    // street address — are snapshotted onto the order itself.
    it("stores the delivery address and an optional map pin on an online order", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { stock: 5 });

      const withPin = await createOrder(admin.token, {
        channel: "WHATSAPP",
        customerName: "ميساء",
        customerPhone: "+970598400400",
        customerAddress: "طولكرم — شارع نابلس",
        customerLatitude: 32.3104,
        customerLongitude: 35.0286,
        items: [{ productId: product.id, quantity: 1 }],
      });
      expect(withPin.status).toBe(201);
      expect(withPin.data!.customerAddress).toBe("طولكرم — شارع نابلس");
      expect(withPin.data!.customerLatitude).toBeCloseTo(32.3104);
      expect(withPin.data!.customerLongitude).toBeCloseTo(35.0286);

      // The pin is optional — an address alone is fine.
      const withoutPin = await createOrder(admin.token, {
        channel: "WHATSAPP",
        customerName: "ميساء",
        customerPhone: "+970598400400",
        customerAddress: "طولكرم",
        items: [{ productId: product.id, quantity: 1 }],
      });
      expect(withoutPin.status).toBe(201);
      expect(withoutPin.data!.customerLatitude).toBeNull();

      // Half a coordinate points nowhere, and neither does an off-globe one.
      const halfPin = await createOrder(admin.token, {
        channel: "WHATSAPP",
        customerName: "ميساء",
        customerPhone: "+970598400400",
        customerLatitude: 32.3104,
        items: [{ productId: product.id, quantity: 1 }],
      });
      expect(halfPin.status).toBe(400);

      const offGlobe = await createOrder(admin.token, {
        channel: "WHATSAPP",
        customerName: "ميساء",
        customerPhone: "+970598400400",
        customerLatitude: 991,
        customerLongitude: 35.0286,
        items: [{ productId: product.id, quantity: 1 }],
      });
      expect(offGlobe.status).toBe(400);
    });

    it("snapshots name, sku, price and cost onto every line", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "75", cost: "30", stock: 4 });

      const res = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 1 }],
      });

      expect(res.status).toBe(201);
      const item = res.data!.items[0];
      expect(item.productId).toBe(product.id);
      expect(item.sku).toMatch(/^ORG-/);
      expect(item.unitPrice).toBe("75.00");
      expect(item.unitCost).toBe("30.00");

      // Repricing the product afterwards must not rewrite the sold line.
      await apiRequest(`/api/products/${product.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { basePrice: "999" },
      });
      const reread = await apiRequest<OrderDto>(`/api/orders/${res.data!.id}`, { token: admin.token });
      expect(reread.data!.items[0].unitPrice).toBe("75.00");
    });

    it("rejects an empty order and an unknown product", async () => {
      const admin = await getSession("ADMIN");

      const empty = await createOrder(admin.token, { channel: "STORE", items: [] });
      expect(empty.status).toBe(400);

      const unknown = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: "does-not-exist", quantity: 1 }],
      });
      expect(unknown.status).toBe(400);
      expect(unknown.error?.code).toBe(ERROR_CODES.ORDER_PRODUCT_UNAVAILABLE);
    });

    it("refuses to sell more than is on the shelf", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { stock: 2 });

      const res = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 3 }],
      });
      expect(res.status).toBe(409);
      expect(res.error?.code).toBe(ERROR_CODES.ORDER_INSUFFICIENT_STOCK);
      expect(await readStock(admin.token, product.id)).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Money — computed server-side, never taken from the client
  // -------------------------------------------------------------------------
  describe("discount math", () => {
    it("applies an item percent discount, then an order amount discount", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", stock: 10 });

      // 100 x 2 = 200, less 10% = 180 subtotal, less a flat 20 = 160.
      const res = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 2, discountType: "PERCENT", discountValue: "10" }],
        discountType: "AMOUNT",
        discountValue: "20",
      });

      expect(res.status).toBe(201);
      expect(res.data!.items[0].discountAmount).toBe("20.00");
      expect(res.data!.items[0].lineTotal).toBe("180.00");
      expect(res.data!.subtotal).toBe("180.00");
      expect(res.data!.discountAmount).toBe("20.00");
      expect(res.data!.total).toBe("160.00");
    });

    it("applies an order percent discount across several lines", async () => {
      const admin = await getSession("ADMIN");
      const first = await sellableProduct(admin.token, { basePrice: "49.99", stock: 5 });
      const second = await sellableProduct(admin.token, { basePrice: "10.005", stock: 5 });

      // 49.99 x 3 = 149.97, plus 10.01 (the stored price rounds to 2dp) x 1
      // = 159.98 subtotal; 25% of that is 39.995, which rounds half up to
      // 40.00, leaving 119.98.
      const res = await createOrder(admin.token, {
        channel: "STORE",
        items: [
          { productId: first.id, quantity: 3 },
          { productId: second.id, quantity: 1 },
        ],
        discountType: "PERCENT",
        discountValue: "25",
      });

      expect(res.status).toBe(201);
      expect(res.data!.subtotal).toBe("159.98");
      expect(res.data!.discountAmount).toBe("40.00");
      expect(res.data!.total).toBe("119.98");
    });

    it("ignores any total the client tries to supply", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", stock: 5 });

      const res = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 1, unitPrice: "1", lineTotal: "1" }],
        subtotal: "1",
        total: "1",
      });

      expect(res.status).toBe(201);
      expect(res.data!.total).toBe("100.00");
      expect(res.data!.items[0].unitPrice).toBe("100.00");
    });

    it("never lets a discount exceed what it discounts", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "50", stock: 5 });

      const res = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 1 }],
        discountType: "AMOUNT",
        discountValue: "500",
      });

      expect(res.status).toBe(201);
      expect(res.data!.discountAmount).toBe("50.00");
      expect(res.data!.total).toBe("0.00");
    });

    it("rejects a malformed discount", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { stock: 5 });

      const overHundred = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 1 }],
        discountType: "PERCENT",
        discountValue: "150",
      });
      expect(overHundred.status).toBe(400);

      const typeWithoutValue = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 1 }],
        discountType: "AMOUNT",
      });
      expect(typeWithoutValue.status).toBe(400);
    });

    it("re-prices an order when an Admin edits its discounts", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", stock: 10 });

      const created = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 2 }],
      });
      expect(created.data!.total).toBe("200.00");

      const edited = await apiRequest<OrderDto>(`/api/orders/${created.data!.id}`, {
        method: "PATCH",
        token: admin.token,
        body: {
          items: [{ id: created.data!.items[0].id, discountType: "PERCENT", discountValue: "50" }],
          discountType: "AMOUNT",
          discountValue: "10",
        },
      });

      expect(edited.status).toBe(200);
      expect(edited.data!.items[0].lineTotal).toBe("100.00");
      expect(edited.data!.subtotal).toBe("100.00");
      expect(edited.data!.total).toBe("90.00");

      // An item entry replaces that line's discount outright, so sending
      // just its id clears it; a cleared order discount does the same.
      const cleared = await apiRequest<OrderDto>(`/api/orders/${created.data!.id}`, {
        method: "PATCH",
        token: admin.token,
        body: {
          items: [{ id: created.data!.items[0].id }],
          discountType: null,
          discountValue: null,
        },
      });
      expect(cleared.status).toBe(200);
      expect(cleared.data!.items[0].discountAmount).toBe("0.00");
      expect(cleared.data!.total).toBe("200.00");
    });

    it("refuses to edit a line that belongs to another order", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { stock: 10 });
      const first = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 1 }],
      });
      const second = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 1 }],
      });

      const res = await apiRequest(`/api/orders/${first.data!.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { items: [{ id: second.data!.items[0].id, discountType: "PERCENT", discountValue: "50" }] },
      });
      expect(res.status).toBe(400);
      expect(res.error?.code).toBe(ERROR_CODES.ORDER_ITEM_NOT_FOUND);
    });

    it("refuses to edit a closed order", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { stock: 5 });
      const created = await createOrder(admin.token, {
        channel: "WHATSAPP",
        customerName: "سارة",
        customerPhone: "+970598200200",
        items: [{ productId: product.id, quantity: 1 }],
      });
      await apiRequest(`/api/orders/${created.data!.id}/status`, {
        method: "PATCH",
        token: admin.token,
        body: { status: "CANCELLED" },
      });

      const res = await apiRequest(`/api/orders/${created.data!.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { note: "متأخر" },
      });
      expect(res.status).toBe(409);
      expect(res.error?.code).toBe(ERROR_CODES.ORDER_NOT_EDITABLE);
    });
  });

  // -------------------------------------------------------------------------
  // Status flow + the stockDeductedAt guard
  // -------------------------------------------------------------------------
  describe("status transitions", () => {
    it("deducts stock exactly once across the whole online flow", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const product = await sellableProduct(admin.token, { stock: 10 });

      const created = await createOrder(employee.token, {
        channel: "WHATSAPP",
        customerName: "ليان",
        customerPhone: "+970599200200",
        items: [{ productId: product.id, quantity: 4 }],
      });
      expect(created.status).toBe(201);
      expect(await readStock(admin.token, product.id)).toBe(10);

      // Only the move to PREPARING commits stock...
      const preparing = await apiRequest<OrderDto>(`/api/orders/${created.data!.id}/status`, {
        method: "PATCH",
        token: employee.token,
        body: { status: "PREPARING" },
      });
      expect(preparing.status).toBe(200);
      expect(preparing.data!.stockDeductedAt).not.toBeNull();
      expect(await readStock(admin.token, product.id)).toBe(6);

      // ...and every later step leaves it alone.
      for (const status of ["DELIVERING", "RECEIVED", "COMPLETED"]) {
        const res = await apiRequest<OrderDto>(`/api/orders/${created.data!.id}/status`, {
          method: "PATCH",
          token: employee.token,
          body: { status },
        });
        expect(res.status).toBe(200);
        expect(res.data!.status).toBe(status);
      }
      expect(await readStock(admin.token, product.id)).toBe(6);
    });

    it("rejects illegal moves", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { stock: 10 });

      const created = await createOrder(admin.token, {
        channel: "WHATSAPP",
        customerName: "رنا",
        customerPhone: "+970599300300",
        items: [{ productId: product.id, quantity: 1 }],
      });

      // NEW may only go to PREPARING or CANCELLED — no skipping ahead.
      for (const status of ["DELIVERING", "RECEIVED", "COMPLETED"]) {
        const res = await apiRequest(`/api/orders/${created.data!.id}/status`, {
          method: "PATCH",
          token: admin.token,
          body: { status },
        });
        expect(res.status).toBe(400);
        expect(res.error?.code).toBe(ERROR_CODES.ORDER_INVALID_STATUS_TRANSITION);
      }

      await apiRequest(`/api/orders/${created.data!.id}/status`, {
        method: "PATCH",
        token: admin.token,
        body: { status: "PREPARING" },
      });

      // ...and no going back.
      const backwards = await apiRequest(`/api/orders/${created.data!.id}/status`, {
        method: "PATCH",
        token: admin.token,
        body: { status: "NEW" },
      });
      expect(backwards.status).toBe(400);
      expect(backwards.error?.code).toBe(ERROR_CODES.ORDER_INVALID_STATUS_TRANSITION);

      // RETURNED is reachable, but only through the returns endpoint, so
      // that stock and returnedQuantity move with it.
      const returned = await apiRequest(`/api/orders/${created.data!.id}/status`, {
        method: "PATCH",
        token: admin.token,
        body: { status: "RETURNED" },
      });
      expect(returned.status).toBe(400);
      expect(returned.error?.code).toBe(ERROR_CODES.ORDER_INVALID_STATUS_TRANSITION);
    });

    it("refuses any move out of a cancelled order", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { stock: 5 });

      const created = await createOrder(admin.token, {
        channel: "WHATSAPP",
        customerName: "هدى",
        customerPhone: "+970599400400",
        items: [{ productId: product.id, quantity: 1 }],
      });
      await apiRequest(`/api/orders/${created.data!.id}/status`, {
        method: "PATCH",
        token: admin.token,
        body: { status: "CANCELLED" },
      });

      const res = await apiRequest(`/api/orders/${created.data!.id}/status`, {
        method: "PATCH",
        token: admin.token,
        body: { status: "PREPARING" },
      });
      expect(res.status).toBe(400);
      expect(res.error?.code).toBe(ERROR_CODES.ORDER_INVALID_STATUS_TRANSITION);
    });

    it("puts stock back when a committed order is cancelled, and leaves it alone otherwise", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { stock: 10 });

      // Cancelled before preparation: nothing was ever deducted.
      const untouched = await createOrder(admin.token, {
        channel: "WHATSAPP",
        customerName: "أمل",
        customerPhone: "+970599500500",
        items: [{ productId: product.id, quantity: 2 }],
      });
      await apiRequest(`/api/orders/${untouched.data!.id}/status`, {
        method: "PATCH",
        token: admin.token,
        body: { status: "CANCELLED" },
      });
      expect(await readStock(admin.token, product.id)).toBe(10);

      // Cancelled after preparation: the deducted stock comes back.
      const committed = await createOrder(admin.token, {
        channel: "WHATSAPP",
        customerName: "أمل",
        customerPhone: "+970599500500",
        items: [{ productId: product.id, quantity: 2 }],
      });
      await apiRequest(`/api/orders/${committed.data!.id}/status`, {
        method: "PATCH",
        token: admin.token,
        body: { status: "PREPARING" },
      });
      expect(await readStock(admin.token, product.id)).toBe(8);

      const cancelled = await apiRequest<OrderDto>(`/api/orders/${committed.data!.id}/status`, {
        method: "PATCH",
        token: admin.token,
        body: { status: "CANCELLED" },
      });
      expect(cancelled.status).toBe(200);
      expect(cancelled.data!.stockDeductedAt).toBeNull();
      expect(await readStock(admin.token, product.id)).toBe(10);
    });
  });

  // -------------------------------------------------------------------------
  // Returns
  // -------------------------------------------------------------------------
  describe("returns", () => {
    async function receivedOrder(token: string, productId: string, quantity: number) {
      const created = await createOrder(token, {
        channel: "WHATSAPP",
        customerName: "دعاء",
        customerPhone: "+970599600600",
        items: [{ productId, quantity }],
      });
      for (const status of ["PREPARING", "DELIVERING", "RECEIVED"]) {
        await apiRequest(`/api/orders/${created.data!.id}/status`, {
          method: "PATCH",
          token,
          body: { status },
        });
      }
      return created.data!;
    }

    it("returns specific quantities, restoring only what came back", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { stock: 10 });
      const order = await receivedOrder(admin.token, product.id, 3);
      expect(await readStock(admin.token, product.id)).toBe(7);

      const res = await apiRequest<OrderDto>(`/api/orders/${order.id}/return`, {
        method: "POST",
        token: admin.token,
        body: { items: [{ orderItemId: order.items[0].id, quantity: 1 }] },
      });

      expect(res.status).toBe(200);
      expect(res.data!.items[0].returnedQuantity).toBe(1);
      // A partial return records the quantity but leaves the order's status.
      expect(res.data!.status).toBe("RECEIVED");
      expect(await readStock(admin.token, product.id)).toBe(8);
    });

    it("returns a whole order and restores all of its stock", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { stock: 10 });
      const order = await receivedOrder(admin.token, product.id, 3);
      expect(await readStock(admin.token, product.id)).toBe(7);

      const res = await apiRequest<OrderDto>(`/api/orders/${order.id}/return`, {
        method: "POST",
        token: admin.token,
        body: {},
      });

      expect(res.status).toBe(200);
      expect(res.data!.status).toBe("RETURNED");
      expect(res.data!.items[0].returnedQuantity).toBe(3);
      expect(await readStock(admin.token, product.id)).toBe(10);
    });

    it("refuses to take back more than was sold, or to return twice", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { stock: 10 });
      const order = await receivedOrder(admin.token, product.id, 2);

      const tooMany = await apiRequest(`/api/orders/${order.id}/return`, {
        method: "POST",
        token: admin.token,
        body: { items: [{ orderItemId: order.items[0].id, quantity: 3 }] },
      });
      expect(tooMany.status).toBe(400);
      expect(tooMany.error?.code).toBe(ERROR_CODES.ORDER_RETURN_QUANTITY_EXCEEDED);
      expect(await readStock(admin.token, product.id)).toBe(8);

      await apiRequest(`/api/orders/${order.id}/return`, { method: "POST", token: admin.token, body: {} });
      const again = await apiRequest(`/api/orders/${order.id}/return`, {
        method: "POST",
        token: admin.token,
        body: {},
      });
      expect(again.status).toBe(409);
      expect(again.error?.code).toBe(ERROR_CODES.ORDER_NOT_RETURNABLE);
      // The second attempt must not inflate stock beyond what was restored.
      expect(await readStock(admin.token, product.id)).toBe(10);
    });

    it("refuses a return before the goods have reached the customer", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { stock: 5 });
      const created = await createOrder(admin.token, {
        channel: "WHATSAPP",
        customerName: "نور",
        customerPhone: "+970599700700",
        items: [{ productId: product.id, quantity: 1 }],
      });

      const res = await apiRequest(`/api/orders/${created.data!.id}/return`, {
        method: "POST",
        token: admin.token,
        body: {},
      });
      expect(res.status).toBe(409);
      expect(res.error?.code).toBe(ERROR_CODES.ORDER_NOT_RETURNABLE);
    });

    it("returns a STORE sale, which is completed the moment it is rung up", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { stock: 10 });

      const created = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 2 }],
      });
      expect(await readStock(admin.token, product.id)).toBe(8);

      const res = await apiRequest<OrderDto>(`/api/orders/${created.data!.id}/return`, {
        method: "POST",
        token: admin.token,
        body: {},
      });
      expect(res.status).toBe(200);
      expect(res.data!.status).toBe("RETURNED");
      expect(await readStock(admin.token, product.id)).toBe(10);
    });
  });

  // -------------------------------------------------------------------------
  // Roles (CLAUDE.md rule 5 / spec.md "Security rationale") — enforced on the
  // backend, never merely hidden in a UI.
  // -------------------------------------------------------------------------
  describe("role gating", () => {
    it("lets an Employee create an order and advance it", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const product = await sellableProduct(admin.token, { stock: 5 });

      const created = await createOrder(employee.token, {
        channel: "WHATSAPP",
        customerName: "بيان",
        customerPhone: "+970599800800",
        items: [{ productId: product.id, quantity: 1 }],
      });
      expect(created.status).toBe(201);

      const advanced = await apiRequest<OrderDto>(`/api/orders/${created.data!.id}/status`, {
        method: "PATCH",
        token: employee.token,
        body: { status: "PREPARING" },
      });
      expect(advanced.status).toBe(200);
      expect(advanced.data!.status).toBe("PREPARING");
    });

    it("blocks an Employee from editing, cancelling, returning or deleting an order", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const product = await sellableProduct(admin.token, { stock: 5 });

      const created = await createOrder(employee.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 1 }],
      });
      expect(created.status).toBe(201);
      const orderId = created.data!.id;

      const edit = await apiRequest(`/api/orders/${orderId}`, {
        method: "PATCH",
        token: employee.token,
        body: { note: "تعديل" },
      });
      expect(edit.status).toBe(403);
      expect(edit.error?.code).toBe(ERROR_CODES.FORBIDDEN);

      const returned = await apiRequest(`/api/orders/${orderId}/return`, {
        method: "POST",
        token: employee.token,
        body: {},
      });
      expect(returned.status).toBe(403);
      expect(returned.error?.code).toBe(ERROR_CODES.FORBIDDEN);

      const removed = await apiRequest(`/api/orders/${orderId}`, { method: "DELETE", token: employee.token });
      expect(removed.status).toBe(403);
      expect(removed.error?.code).toBe(ERROR_CODES.FORBIDDEN);

      // Cancelling is refused even though the same endpoint accepts an
      // Employee's forward moves — the check is on the destination, not the
      // route (spec.md: a sale must not be erasable to cover theft).
      const online = await createOrder(employee.token, {
        channel: "WEBSITE",
        customerName: "لمى",
        customerPhone: "+970599900900",
        items: [{ productId: product.id, quantity: 1 }],
      });
      const cancelled = await apiRequest(`/api/orders/${online.data!.id}/status`, {
        method: "PATCH",
        token: employee.token,
        body: { status: "CANCELLED" },
      });
      expect(cancelled.status).toBe(403);
      expect(cancelled.error?.code).toBe(ERROR_CODES.FORBIDDEN);

      // ...and the order really is untouched.
      const reread = await apiRequest<OrderDto>(`/api/orders/${online.data!.id}`, { token: admin.token });
      expect(reread.data!.status).toBe("NEW");
    });

    it("hides unitCost from an Employee but shows it to a Manager", async () => {
      const admin = await getSession("ADMIN");
      const manager = await getSession("MANAGER");
      const employee = await getSession("EMPLOYEE");
      const product = await sellableProduct(admin.token, { cost: "30", stock: 5 });

      const created = await createOrder(employee.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 1 }],
      });
      // Not merely null — absent entirely (CLAUDE.md rule 19).
      expect(created.data!.items[0]).not.toHaveProperty("unitCost");

      const asManager = await apiRequest<OrderDto>(`/api/orders/${created.data!.id}`, { token: manager.token });
      expect(asManager.data!.items[0].unitCost).toBe("30.00");
    });

    it("lets a Manager cancel and delete", async () => {
      const admin = await getSession("ADMIN");
      const manager = await getSession("MANAGER");
      const product = await sellableProduct(admin.token, { stock: 5 });

      const toCancel = await createOrder(manager.token, {
        channel: "WHATSAPP",
        customerName: "جنى",
        customerPhone: "+970598100100",
        items: [{ productId: product.id, quantity: 1 }],
      });
      const cancelled = await apiRequest<OrderDto>(`/api/orders/${toCancel.data!.id}/status`, {
        method: "PATCH",
        token: manager.token,
        body: { status: "CANCELLED" },
      });
      expect(cancelled.status).toBe(200);
      expect(cancelled.data!.status).toBe("CANCELLED");

      const removed = await apiRequest(`/api/orders/${toCancel.data!.id}`, {
        method: "DELETE",
        token: manager.token,
      });
      expect(removed.status).toBe(200);
    });

    it("puts deducted stock back when an order is deleted", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { stock: 10 });

      const created = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 3 }],
      });
      expect(await readStock(admin.token, product.id)).toBe(7);

      const removed = await apiRequest(`/api/orders/${created.data!.id}`, {
        method: "DELETE",
        token: admin.token,
      });
      expect(removed.status).toBe(200);
      expect(await readStock(admin.token, product.id)).toBe(10);

      const gone = await apiRequest(`/api/orders/${created.data!.id}`, { token: admin.token });
      expect(gone.status).toBe(404);
      expect(gone.error?.code).toBe(ERROR_CODES.ORDER_NOT_FOUND);
    });
  });

  // -------------------------------------------------------------------------
  // Listing (CLAUDE.md rule 15: pagination + filtering + sorting, never
  // an unbounded list)
  // -------------------------------------------------------------------------
  describe("listing", () => {
    it("paginates, filters by status and channel, and sorts", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "100", stock: 10 });

      const cheap = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 1 }],
      });
      const dear = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 3 }],
      });
      expect(dear.status).toBe(201);

      const page = await apiRequest<OrderSummaryDto[]>("/api/orders?pageSize=2&page=1", { token: admin.token });
      expect(page.status).toBe(200);
      expect(page.data!.length).toBeLessThanOrEqual(2);
      expect(page.meta!.pageSize).toBe(2);
      expect(page.meta!.total).toBeGreaterThanOrEqual(2);

      const byChannel = await apiRequest<OrderSummaryDto[]>("/api/orders?channel=STORE&status=COMPLETED", {
        token: admin.token,
      });
      expect(byChannel.status).toBe(200);
      expect(byChannel.data!.every((o) => o.channel === "STORE" && o.status === "COMPLETED")).toBe(true);

      const sorted = await apiRequest<OrderSummaryDto[]>("/api/orders?sortBy=total&sortDir=desc&pageSize=100", {
        token: admin.token,
      });
      const totals = sorted.data!.map((o) => Number(o.total));
      expect([...totals].sort((a, b) => b - a)).toEqual(totals);

      // The list rows carry an item count rather than every line.
      const listed = await apiRequest<OrderSummaryDto[]>(`/api/orders?q=${cheap.data!.orderNumber}`, {
        token: admin.token,
      });
      expect(listed.data!.some((o) => o.id === cheap.data!.id)).toBe(true);
      expect(listed.data!.find((o) => o.id === cheap.data!.id)!.itemCount).toBe(1);
    });

    it("filters by date range", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { stock: 5 });
      const created = await createOrder(admin.token, {
        channel: "STORE",
        items: [{ productId: product.id, quantity: 1 }],
      });

      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const inRange = await apiRequest<OrderSummaryDto[]>(
        `/api/orders?dateFrom=${yesterday}&dateTo=${tomorrow}&pageSize=100`,
        { token: admin.token }
      );
      expect(inRange.data!.some((o) => o.id === created.data!.id)).toBe(true);

      const outOfRange = await apiRequest<OrderSummaryDto[]>(`/api/orders?dateTo=${yesterday}&pageSize=100`, {
        token: admin.token,
      });
      expect(outOfRange.data!.some((o) => o.id === created.data!.id)).toBe(false);
    });

    it("finds an order by number or by customer, without choking on a long digit run", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { stock: 5 });
      const created = await createOrder(admin.token, {
        channel: "WHATSAPP",
        customerName: "فاطمة الزهراء",
        customerPhone: "+970598300300",
        items: [{ productId: product.id, quantity: 1 }],
      });

      const byNumber = await apiRequest<OrderSummaryDto[]>(`/api/orders?q=${created.data!.orderNumber}`, {
        token: admin.token,
      });
      expect(byNumber.data!.some((o) => o.id === created.data!.id)).toBe(true);

      const byName = await apiRequest<OrderSummaryDto[]>(
        `/api/orders?q=${encodeURIComponent("فاطمة الزهراء")}&pageSize=100`,
        { token: admin.token }
      );
      expect(byName.data!.some((o) => o.id === created.data!.id)).toBe(true);

      // A phone number is a run of digits far past a 32-bit order number —
      // it must be matched as text, not handed to Postgres as an integer.
      const byPhone = await apiRequest<OrderSummaryDto[]>("/api/orders?q=970598300300&pageSize=100", {
        token: admin.token,
      });
      expect(byPhone.status).toBe(200);
      expect(byPhone.data!.some((o) => o.id === created.data!.id)).toBe(true);
    });

    it("404s an unknown order", async () => {
      const admin = await getSession("ADMIN");
      const res = await apiRequest("/api/orders/does-not-exist", { token: admin.token });
      expect(res.status).toBe(404);
      expect(res.error?.code).toBe(ERROR_CODES.ORDER_NOT_FOUND);
    });
  });
});
