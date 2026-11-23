// Exchange money rules (spec.md "Exchanges"): what comes back is worth what was paid, and the settlement must fit the side that owes.
import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { exchangeCashMovement, exchangeCredit, resolveReturnLines, resolveSettlement } from "@/lib/orderExchange";

const d = (value: string | number) => new Prisma.Decimal(value);

function order(overrides: Record<string, unknown> = {}) {
  return {
    status: "COMPLETED",
    type: "SALE",
    deletedAt: null,
    paymentStatus: "COLLECTED",
    onCredit: false,
    exchangeOfOrderId: null,
    paidAmount: d(0),
    subtotal: d(300),
    total: d(300),
    items: [
      { id: "a", quantity: 1, returnedQuantity: 0, lineTotal: d(100) },
      { id: "b", quantity: 2, returnedQuantity: 0, lineTotal: d(200) },
    ],
    ...overrides,
  };
}

describe("exchangeCredit", () => {
  it("is what the pieces were sold for", () => {
    expect(exchangeCredit(order(), new Map([["b", 1]])).toFixed(2)).toBe("100.00");
  });

  it("carries the order discount onto each piece", () => {
    // 10% off the whole sale: a 100 piece was really sold for 90.
    expect(exchangeCredit(order({ total: d(270) }), new Map([["a", 1]])).toFixed(2)).toBe("90.00");
  });

  it("on an account, carries only what was paid for the pieces", () => {
    const credit = order({ onCredit: true, paymentStatus: "ON_CREDIT", paidAmount: d(250) });
    // Keeping 200 worth, 250 paid: 50 of the returned 100 was paid for, the rest just leaves the debt.
    expect(exchangeCredit(credit, new Map([["a", 1]])).toFixed(2)).toBe("50.00");
    expect(exchangeCredit({ ...credit, paidAmount: d(100) }, new Map([["a", 1]])).toFixed(2)).toBe("0.00");
  });
});

describe("resolveReturnLines", () => {
  it("adds up entries for one line and refuses more than is left", () => {
    expect(resolveReturnLines(order().items, [{ orderItemId: "b", quantity: 1 }]).get("b")).toBe(1);
    expect(() =>
      resolveReturnLines(order().items, [
        { orderItemId: "b", quantity: 1 },
        { orderItemId: "b", quantity: 2 },
      ]),
    ).toThrow();
    expect(() => resolveReturnLines(order().items, [{ orderItemId: "x", quantity: 1 }])).toThrow();
  });
});

describe("resolveSettlement", () => {
  it("is EVEN when nothing changes hands, whatever was asked", () => {
    expect(resolveSettlement(d(0), "PAID")).toBe("EVEN");
  });

  it("accepts only the owing side's choices", () => {
    expect(resolveSettlement(d(20), "DEBT")).toBe("DEBT");
    expect(resolveSettlement(d(20), "WAIVED")).toBe("WAIVED");
    expect(() => resolveSettlement(d(20), "REFUNDED")).toThrow();
    expect(resolveSettlement(d(-20), "KEPT")).toBe("KEPT");
    expect(() => resolveSettlement(d(-20), "PAID")).toThrow();
  });
});

describe("exchangeCashMovement", () => {
  it("moves cash only when the difference is paid or paid back", () => {
    expect(exchangeCashMovement(d(20), "PAID").toFixed(2)).toBe("20.00");
    expect(exchangeCashMovement(d(-20), "REFUNDED").toFixed(2)).toBe("-20.00");
    expect(exchangeCashMovement(d(20), "DEBT").toFixed(2)).toBe("0.00");
    expect(exchangeCashMovement(d(-20), "KEPT").toFixed(2)).toBe("0.00");
  });
});
