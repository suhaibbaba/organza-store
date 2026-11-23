import { afterAll, describe, expect, it } from "vitest";
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { createSellableProduct, readStock } from "@tests/support/orders";
import { num } from "@tests/support/reports";
import { ERROR_CODES } from "@/constants";
import type { OrderDto } from "@tests/types";

// Exchanges (spec.md "Exchanges"): pieces back on the shelf, new pieces out as their own sale, the difference settled.
describe("Exchanges", () => {
  const openedOrderIds: string[] = [];
  const openedProductIds: string[] = [];
  const openedCustomerIds: string[] = [];

  async function sell(token: string, items: { productId: string; quantity: number }[], extra: object = {}) {
    const res = await apiRequest<OrderDto>("/api/orders", {
      method: "POST",
      token,
      body: { channel: "STORE", items, ...extra },
    });
    expect(res.status).toBe(201);
    openedOrderIds.push(res.data!.id);
    return res.data!;
  }

  async function exchange(token: string, orderId: string, body: object) {
    const res = await apiRequest<OrderDto>(`/api/orders/${orderId}/exchange`, { method: "POST", token, body });
    if (res.data?.id) {
      openedOrderIds.unshift(res.data.id);
    }
    return res;
  }

  async function product(token: string, basePrice: string, stock = 5) {
    const created = await createSellableProduct(token, { basePrice, stock });
    openedProductIds.push(created.id);
    return created;
  }

  async function readOrder(token: string, id: string) {
    return (await apiRequest<OrderDto>(`/api/orders/${id}`, { token })).data!;
  }

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    // Exchanges first: an original with live exchanges refuses deletion.
    for (const id of openedOrderIds) {
      await apiRequest(`/api/orders/${id}`, { method: "DELETE", token: admin.token });
    }
    for (const id of openedProductIds) {
      await apiRequest(`/api/products/${id}`, { method: "DELETE", token: admin.token });
    }
    for (const id of openedCustomerIds) {
      await apiRequest(`/api/customers/${id}`, { method: "DELETE", token: admin.token });
    }
  });

  it("lets an Employee swap a piece for a dearer one and pay the difference", async () => {
    const employee = await getSession("EMPLOYEE");
    const admin = await getSession("ADMIN");
    const dress = await product(admin.token, "100");
    const abaya = await product(admin.token, "150");
    const original = await sell(employee.token, [{ productId: dress.id, quantity: 1 }]);

    const preview = await apiRequest<{ credit: string }>(`/api/orders/${original.id}/exchange/preview`, {
      method: "POST",
      token: employee.token,
      body: { returnItems: [{ orderItemId: original.items[0].id, quantity: 1 }] },
    });
    expect(preview.status).toBe(200);
    expect(num(preview.data!.credit)).toBe(100);

    const res = await exchange(employee.token, original.id, {
      returnItems: [{ orderItemId: original.items[0].id, quantity: 1 }],
      items: [{ productId: abaya.id, quantity: 1 }],
      settlement: "PAID",
    });
    expect(res.status).toBe(201);
    const created = res.data!;
    expect(created.exchangeOf?.id).toBe(original.id);
    expect(created.exchangeSettlement).toBe("PAID");
    expect(num(created.exchangeCredit)).toBe(100);
    expect(num(created.total)).toBe(150);
    expect(created.paymentStatus).toBe("COLLECTED");
    // 100 carried over from the dress, 50 in cash.
    expect(created.payments.map((p) => [p.method, num(p.amount)])).toEqual([
      ["EXCHANGE", 100],
      ["CASH", 50],
    ]);

    // The dress is back on the shelf, the abaya is gone.
    expect(await readStock(admin.token, dress.id)).toBe(5);
    expect(await readStock(admin.token, abaya.id)).toBe(4);

    const after = await readOrder(admin.token, original.id);
    expect(after.status).toBe("RETURNED");
    expect(after.items[0].returnedQuantity).toBe(1);
    expect(after.items[0].exchangedQuantity).toBe(1);
    expect(after.exchanges.map((e) => e.id)).toEqual([created.id]);
  });

  it("pays back or keeps the difference when the new piece is cheaper", async () => {
    const admin = await getSession("ADMIN");
    const dress = await product(admin.token, "100");
    const scarf = await product(admin.token, "30");

    const refunded = await sell(admin.token, [{ productId: dress.id, quantity: 1 }]);
    const refund = await exchange(admin.token, refunded.id, {
      returnItems: [{ orderItemId: refunded.items[0].id, quantity: 1 }],
      items: [{ productId: scarf.id, quantity: 1 }],
      settlement: "REFUNDED",
    });
    expect(refund.status).toBe(201);
    expect(num(refund.data!.total)).toBe(30);
    expect(refund.data!.payments.map((p) => [p.method, num(p.amount)])).toEqual([
      ["EXCHANGE", 100],
      ["CASH", -70],
    ]);

    const kept = await sell(admin.token, [{ productId: dress.id, quantity: 1 }]);
    const keep = await exchange(admin.token, kept.id, {
      returnItems: [{ orderItemId: kept.items[0].id, quantity: 1 }],
      items: [{ productId: scarf.id, quantity: 1 }],
      settlement: "KEPT",
    });
    expect(keep.status).toBe(201);
    // The 70 the shop kept is revenue on the exchange, so it is inside the total.
    expect(num(keep.data!.exchangeKept)).toBe(70);
    expect(num(keep.data!.total)).toBe(100);
    expect(num(keep.data!.subtotal)).toBe(30);
    expect(keep.data!.payments.map((p) => p.method)).toEqual(["EXCHANGE"]);
  });

  it("lets the shop waive the difference as a discount", async () => {
    const admin = await getSession("ADMIN");
    const dress = await product(admin.token, "100");
    const abaya = await product(admin.token, "130");
    const original = await sell(admin.token, [{ productId: dress.id, quantity: 1 }]);

    const res = await exchange(admin.token, original.id, {
      returnItems: [{ orderItemId: original.items[0].id, quantity: 1 }],
      items: [{ productId: abaya.id, quantity: 1 }],
      settlement: "WAIVED",
    });
    expect(res.status).toBe(201);
    expect(res.data!.discountType).toBe("AMOUNT");
    expect(num(res.data!.discountAmount)).toBe(30);
    expect(num(res.data!.total)).toBe(100);
    expect(res.data!.paymentStatus).toBe("COLLECTED");
  });

  it("records an unpaid difference as the customer's debt", async () => {
    const admin = await getSession("ADMIN");
    const dress = await product(admin.token, "100");
    const abaya = await product(admin.token, "160");
    const original = await sell(admin.token, [{ productId: dress.id, quantity: 1 }]);
    const body = {
      returnItems: [{ orderItemId: original.items[0].id, quantity: 1 }],
      items: [{ productId: abaya.id, quantity: 1 }],
      settlement: "DEBT",
    };

    // A counter sale has nobody to owe it.
    const nobody = await exchange(admin.token, original.id, body);
    expect(nobody.status).toBe(400);
    expect(nobody.error?.code).toBe(ERROR_CODES.ORDER_EXCHANGE_CUSTOMER_REQUIRED);

    const phone = `+97059${String(Date.now()).slice(-7)}`;
    const customer = await apiRequest<{ id: string }>("/api/customers", {
      method: "POST",
      token: admin.token,
      body: { name: "زبونة تبديل", phone },
    });
    expect(customer.status).toBe(201);
    openedCustomerIds.push(customer.data!.id);

    const res = await exchange(admin.token, original.id, { ...body, customerId: customer.data!.id });
    expect(res.status).toBe(201);
    expect(res.data!.onCredit).toBe(true);
    expect(res.data!.paymentStatus).toBe("ON_CREDIT");
    expect(num(res.data!.balance)).toBe(60);
  });

  it("refuses a settlement for the wrong side, a quick-sold piece and a gift", async () => {
    const admin = await getSession("ADMIN");
    const dress = await product(admin.token, "100");
    const abaya = await product(admin.token, "150");
    const original = await sell(admin.token, [{ productId: dress.id, quantity: 1 }]);
    const returnItems = [{ orderItemId: original.items[0].id, quantity: 1 }];

    const wrongSide = await exchange(admin.token, original.id, {
      returnItems,
      items: [{ productId: abaya.id, quantity: 1 }],
      settlement: "REFUNDED",
    });
    expect(wrongSide.status).toBe(400);
    expect(wrongSide.error?.code).toBe(ERROR_CODES.ORDER_EXCHANGE_SETTLEMENT_INVALID);

    const quick = await exchange(admin.token, original.id, {
      returnItems,
      items: [{ quickSell: { name: "قطعة", price: "50" }, quantity: 1 }],
      settlement: "PAID",
    });
    expect(quick.status).toBe(400);

    const gift = await sell(admin.token, [{ productId: dress.id, quantity: 1 }], { type: "GIFT" });
    const fromGift = await exchange(admin.token, gift.id, {
      returnItems: [{ orderItemId: gift.items[0].id, quantity: 1 }],
      items: [{ productId: abaya.id, quantity: 1 }],
      settlement: "PAID",
    });
    expect(fromGift.status).toBe(409);
    expect(fromGift.error?.code).toBe(ERROR_CODES.ORDER_NOT_EXCHANGEABLE);

    // Nothing moved on any refusal.
    expect(await readStock(admin.token, abaya.id)).toBe(5);
  });

  it("keeps an exchanged sale from being deleted or re-priced", async () => {
    const admin = await getSession("ADMIN");
    const dress = await product(admin.token, "100");
    const other = await product(admin.token, "100");
    const original = await sell(admin.token, [{ productId: dress.id, quantity: 2 }]);
    const res = await exchange(admin.token, original.id, {
      returnItems: [{ orderItemId: original.items[0].id, quantity: 1 }],
      items: [{ productId: other.id, quantity: 1 }],
      settlement: "PAID",
    });
    expect(res.status).toBe(201);
    expect(res.data!.exchangeSettlement).toBe("EVEN");

    const remove = await apiRequest(`/api/orders/${original.id}`, { method: "DELETE", token: admin.token });
    expect(remove.status).toBe(409);
    expect(remove.error?.code).toBe(ERROR_CODES.ORDER_HAS_EXCHANGES);

    const reprice = await apiRequest(`/api/orders/${res.data!.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { discountType: "AMOUNT", discountValue: "10" },
    });
    expect(reprice.status).toBe(409);

    // The other piece can still be exchanged, or returned the ordinary way.
    const after = await readOrder(admin.token, original.id);
    expect(after.status).toBe("COMPLETED");
    expect(after.items[0].quantity - after.items[0].returnedQuantity).toBe(1);
  });

  it("finds the sale a piece came from by its code", async () => {
    const admin = await getSession("ADMIN");
    const dress = await product(admin.token, "100");
    const original = await sell(admin.token, [{ productId: dress.id, quantity: 1 }]);
    const sku = original.items[0].sku!;
    const res = await apiRequest<{ id: string }[]>(`/api/orders?itemCode=${encodeURIComponent(sku)}`, {
      token: admin.token,
    });
    expect(res.status).toBe(200);
    expect(res.data!.map((order) => order.id)).toContain(original.id);
  });
});
