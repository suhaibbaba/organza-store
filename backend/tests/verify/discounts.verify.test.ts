// ============================================================================
//  2. DISCOUNTS, TOTALS AND ROUNDING
//
//  Every figure here is asserted to the agora, because this is where a money
//  bug would actually cost the shop something.
//
//    * a percentage and a fixed amount, at line level and order level, alone
//      and together;
//    * rounding to 2 places, HALF UP, with no floating-point drift anywhere —
//      3 x 0.10 is 0.30, not 0.30000000000000004;
//    * the server recomputes every total from the catalogue: a client that
//      sends its own unitPrice, lineTotal, subtotal or total is ignored;
//    * a discount is never negative, never more than 100%, and never larger
//      than the thing it discounts.
//
//  NOTE on the last one: the API CLAMPS an over-large discount rather than
//  refusing it (lib/money.ts resolveDiscountAmount) — a 500.00 discount on a
//  100.00 line becomes exactly 100.00 and the total becomes 0.00, never
//  negative. Malformed discounts (a negative value, a percentage over 100, a
//  type with no value) ARE refused. Both behaviours are pinned below.
// ============================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { expectMoney, expectMoneyShape } from "@tests/support/money";
import { createPricedProduct, readOrder, sell, sellRequest } from "@tests/support/verify";
import {
  DRIFT_EXPECTED_LINE_TOTAL,
  DRIFT_QUANTITY,
  DRIFT_UNIT_PRICE,
  HALF_UP_EXPECTED_DISCOUNT,
  HALF_UP_EXPECTED_TOTAL,
  HALF_UP_PERCENT,
  ITEM_AMOUNT,
  ITEM_PERCENT,
  ORDER_AMOUNT,
  ORDER_PERCENT,
  UNIT_PRICE,
} from "@tests/constants";
import type { OrderDto, PricedProduct } from "@tests/types";

describe("Verify · discounts, totals and rounding", () => {
  let admin: string;
  let product: PricedProduct;

  beforeAll(async () => {
    admin = (await getSession("ADMIN")).token;
    // 100.00 a piece, plenty on the shelf: every figure below is a round
    // number of it, so a wrong answer is visibly wrong.
    product = await createPricedProduct(admin, { basePrice: UNIT_PRICE });
  });

  describe("one level at a time", () => {
    it("takes a percentage off a line: 2 x 100.00 less 10% = 180.00", async () => {
      const order = await sell(admin, [
        { productId: product.id, quantity: 2, discountType: "PERCENT", discountValue: ITEM_PERCENT },
      ]);

      expectMoney(order.items[0].unitPrice, "100.00", "unit price");
      expectMoney(order.items[0].discountAmount, "20.00", "line discount (10% of 200.00)");
      expectMoney(order.items[0].lineTotal, "180.00", "line total");
      expectMoney(order.subtotal, "180.00", "subtotal (line totals, item discounts already applied)");
      expectMoney(order.discountAmount, "0.00", "order-level discount (there was none)");
      expectMoney(order.total, "180.00", "order total");
    });

    it("takes a fixed amount off a line: 100.00 less 15.50 = 84.50", async () => {
      const order = await sell(admin, [
        { productId: product.id, quantity: 1, discountType: "AMOUNT", discountValue: ITEM_AMOUNT },
      ]);

      expectMoney(order.items[0].discountAmount, ITEM_AMOUNT, "line discount (fixed)");
      expectMoney(order.items[0].lineTotal, "84.50", "line total");
      expectMoney(order.total, "84.50", "order total");
    });

    it("takes a percentage off the order: 200.00 less 12.5% = 175.00", async () => {
      const order = await sell(admin, [{ productId: product.id, quantity: 2 }], {
        discountType: "PERCENT",
        discountValue: ORDER_PERCENT,
      });

      expectMoney(order.subtotal, "200.00", "subtotal before the order discount");
      expectMoney(order.discountAmount, "25.00", "order discount (12.5% of 200.00)");
      expectMoney(order.total, "175.00", "order total");
    });

    it("takes a fixed amount off the order: 200.00 less 25.00 = 175.00", async () => {
      const order = await sell(admin, [{ productId: product.id, quantity: 2 }], {
        discountType: "AMOUNT",
        discountValue: ORDER_AMOUNT,
      });

      expectMoney(order.discountAmount, ORDER_AMOUNT, "order discount (fixed)");
      expectMoney(order.total, "175.00", "order total");
    });
  });

  describe("both levels at once", () => {
    it("applies the line discount first, then the order discount to what is left", async () => {
      // 2 x 100.00 = 200.00, less 10% on the line = 180.00,
      // less 12.5% of THAT (22.50) = 157.50.
      const order = await sell(
        admin,
        [{ productId: product.id, quantity: 2, discountType: "PERCENT", discountValue: ITEM_PERCENT }],
        { discountType: "PERCENT", discountValue: ORDER_PERCENT }
      );

      expectMoney(order.items[0].discountAmount, "20.00", "line discount");
      expectMoney(order.items[0].lineTotal, "180.00", "line total after the line discount");
      expectMoney(order.subtotal, "180.00", "subtotal");
      expectMoney(order.discountAmount, "22.50", "order discount (12.5% of 180.00, NOT of 200.00)");
      expectMoney(order.total, "157.50", "order total");
    });

    it("spreads across several lines: two discounted lines under one order discount", async () => {
      // Line A: 3 x 100.00 less 10%     = 270.00
      // Line B: 1 x 100.00 less 15.50   =  84.50
      //   subtotal                      = 354.50
      //   less 25.00 off the order      = 329.50
      const order = await sell(
        admin,
        [
          { productId: product.id, quantity: 3, discountType: "PERCENT", discountValue: ITEM_PERCENT },
          { productId: product.id, quantity: 1, discountType: "AMOUNT", discountValue: ITEM_AMOUNT },
        ],
        { discountType: "AMOUNT", discountValue: ORDER_AMOUNT }
      );

      const [lineA, lineB] = order.items;
      expectMoney(lineA.lineTotal, "270.00", "line A total (3 x 100.00 less 10%)");
      expectMoney(lineB.lineTotal, "84.50", "line B total (100.00 less 15.50)");
      expectMoney(order.subtotal, "354.50", "subtotal across both lines");
      expectMoney(order.discountAmount, "25.00", "order discount");
      expectMoney(order.total, "329.50", "order total");
    });
  });

  describe("rounding, and the absence of float drift", () => {
    it("prices 3 x 0.10 as exactly 0.30 (a Float would say 0.30000000000000004)", async () => {
      const penny = await createPricedProduct(admin, { basePrice: DRIFT_UNIT_PRICE, cost: "0.05" });
      const order = await sell(admin, [{ productId: penny.id, quantity: DRIFT_QUANTITY }]);

      expectMoney(order.items[0].lineTotal, DRIFT_EXPECTED_LINE_TOTAL, "3 x 0.10 on one line");
      expectMoney(order.total, DRIFT_EXPECTED_LINE_TOTAL, "order total for 3 x 0.10");
    });

    it("adds 0.10 + 0.10 + 0.10 across three separate lines to exactly 0.30", async () => {
      const penny = await createPricedProduct(admin, { basePrice: DRIFT_UNIT_PRICE, cost: "0.05" });
      const order = await sell(
        admin,
        Array.from({ length: DRIFT_QUANTITY }, () => ({ productId: penny.id, quantity: 1 }))
      );

      for (const item of order.items) expectMoney(item.lineTotal, "0.10", "each 0.10 line");
      expectMoney(order.subtotal, DRIFT_EXPECTED_LINE_TOTAL, "subtotal of three 0.10 lines");
      expectMoney(order.total, DRIFT_EXPECTED_LINE_TOTAL, "order total of three 0.10 lines");
    });

    it("rounds a half-agora HALF UP: 12.345% of 100.00 is 12.35, not 12.34", async () => {
      const order = await sell(admin, [
        { productId: product.id, quantity: 1, discountType: "PERCENT", discountValue: HALF_UP_PERCENT },
      ]);

      expectMoney(order.items[0].discountAmount, HALF_UP_EXPECTED_DISCOUNT, "12.345% of 100.00, rounded half up");
      expectMoney(order.items[0].lineTotal, HALF_UP_EXPECTED_TOTAL, "line total after a half-agora discount");
      expectMoney(order.total, HALF_UP_EXPECTED_TOTAL, "order total");
    });

    it("returns every amount as a 2dp string — money is Decimal, never Float", async () => {
      const order = await sell(
        admin,
        [{ productId: product.id, quantity: 2, discountType: "PERCENT", discountValue: ITEM_PERCENT }],
        { discountType: "AMOUNT", discountValue: ORDER_AMOUNT }
      );

      expectMoneyShape(order.subtotal, "order.subtotal");
      expectMoneyShape(order.discountAmount, "order.discountAmount");
      expectMoneyShape(order.total, "order.total");
      expectMoneyShape(order.items[0].unitPrice, "item.unitPrice");
      expectMoneyShape(order.items[0].discountAmount, "item.discountAmount");
      expectMoneyShape(order.items[0].lineTotal, "item.lineTotal");
      expectMoneyShape(order.items[0].discountValue, "item.discountValue");
    });
  });

  describe("the client never gets to name the price", () => {
    it("ignores a tampered unitPrice, lineTotal, subtotal, total and discountAmount on creation", async () => {
      const res = await sellRequest(
        admin,
        // Every money field a hostile client could think to send.
        [{ productId: product.id, quantity: 2, unitPrice: "1.00", unitCost: "0.01", lineTotal: "1.00" } as never],
        {
          extra: {
            subtotal: "1.00",
            total: "1.00",
            discountAmount: "199.00",
            grandTotal: "1.00",
          },
        }
      );

      expect(res.status, "a tampered total must not break the sale, only be ignored").toBe(201);
      const order = res.data!;
      expectMoney(order.items[0].unitPrice, "100.00", "unit price (server's, not the client's 1.00)");
      expectMoney(order.items[0].lineTotal, "200.00", "line total (server's, not the client's 1.00)");
      expectMoney(order.subtotal, "200.00", "subtotal (server's)");
      expectMoney(order.discountAmount, "0.00", "discount (the client's 199.00 must not be honoured)");
      expectMoney(order.total, "200.00", "order total (server's, not the client's 1.00)");

      // ...and it is the server's figure that was actually stored.
      const stored = await readOrder(admin, order.id);
      expectMoney(stored.total, "200.00", "stored order total");
    });

    it("ignores a tampered total on an edit, and re-prices from the stored snapshot", async () => {
      const order = await sell(admin, [{ productId: product.id, quantity: 2 }], {
        channel: "WHATSAPP",
      });
      expectMoney(order.total, "200.00", "total before the edit");

      const edited = await apiRequest<OrderDto>(`/api/orders/${order.id}`, {
        method: "PATCH",
        token: admin,
        body: {
          discountType: "PERCENT",
          discountValue: ITEM_PERCENT,
          // All fiction.
          subtotal: "5.00",
          total: "5.00",
          discountAmount: "195.00",
        },
      });

      expect(edited.status, "the edit itself must succeed").toBe(200);
      expectMoney(edited.data!.subtotal, "200.00", "subtotal after the edit (recomputed from the lines)");
      expectMoney(edited.data!.discountAmount, "20.00", "order discount after the edit (10% of 200.00)");
      expectMoney(edited.data!.total, "180.00", "order total after the edit");
    });
  });

  describe("discounts that are not real discounts", () => {
    it("refuses a negative percentage and a negative amount", async () => {
      for (const [type, value] of [
        ["PERCENT", "-10"],
        ["AMOUNT", "-25"],
      ] as const) {
        const res = await sellRequest(admin, [{ productId: product.id, quantity: 1 }], {
          discountType: type,
          discountValue: value,
        });
        expect(res.status, `a ${type} discount of ${value} must be refused`).toBe(400);
        expect(res.success, "and refused through the error envelope").toBe(false);
        expect(res.error?.code, "with a translation key, never a sentence").toMatch(/^error\./);
      }
    });

    it("refuses a percentage over 100", async () => {
      const res = await sellRequest(admin, [{ productId: product.id, quantity: 1 }], {
        discountType: "PERCENT",
        discountValue: "150",
      });
      expect(res.status, "a 150% discount must be refused").toBe(400);
      expect(res.error?.code, "with a translation key").toMatch(/^error\./);
    });

    it("refuses a negative percentage on a LINE as well as on the order", async () => {
      const res = await sellRequest(admin, [
        { productId: product.id, quantity: 1, discountType: "PERCENT", discountValue: "-5" },
      ]);
      expect(res.status, "a negative line discount must be refused").toBe(400);
    });

    it("refuses a discount type with no value, and a value with no type", async () => {
      const noValue = await sellRequest(admin, [{ productId: product.id, quantity: 1 }], {
        discountType: "AMOUNT",
        discountValue: null,
      });
      expect(noValue.status, "a type with no value is half a discount").toBe(400);

      const noType = await sellRequest(admin, [{ productId: product.id, quantity: 1 }], {
        extra: { discountValue: "10" },
      });
      expect(noType.status, "a value with no type is the other half").toBe(400);
    });

    it("clamps a discount larger than the line it is taken off — and never goes negative", async () => {
      const order = await sell(admin, [
        { productId: product.id, quantity: 1, discountType: "AMOUNT", discountValue: "500" },
      ]);

      expectMoney(order.items[0].discountAmount, "100.00", "line discount clamped to the line total");
      expectMoney(order.items[0].lineTotal, "0.00", "line total (free, never negative)");
      expectMoney(order.total, "0.00", "order total (free, never negative)");
    });

    it("clamps a discount larger than the ORDER it is taken off", async () => {
      const order = await sell(admin, [{ productId: product.id, quantity: 1 }], {
        discountType: "AMOUNT",
        discountValue: "999999",
      });

      expectMoney(order.discountAmount, "100.00", "order discount clamped to the subtotal");
      expectMoney(order.total, "0.00", "order total (free, never negative)");
    });

    it("charges 100.00 for a 100% discount on one line and nothing on another", async () => {
      // Free on one line must not make the whole order free.
      const order = await sell(admin, [
        { productId: product.id, quantity: 1, discountType: "PERCENT", discountValue: "100" },
        { productId: product.id, quantity: 1 },
      ]);

      expectMoney(order.items[0].lineTotal, "0.00", "the free line");
      expectMoney(order.items[1].lineTotal, "100.00", "the line that was not discounted");
      expectMoney(order.total, "100.00", "order total");
    });
  });
});
