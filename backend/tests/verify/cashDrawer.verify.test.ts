// ============================================================================
//  5. THE CASH DRAWER — a whole day, walked end to end
//
//      expected   = openingFloat + cash sales − cash expenses
//      difference = counted − expected
//      tomorrow's openingFloat = counted − withdrawn
//
//  Every figure below is an absolute, not a delta, because the day it walks
//  is one the suite owns outright.
//
//  SAFETY — the two rules this file will not break:
//
//    1. It never opens, closes or touches a drawer for a REAL trading day.
//       The walk happens on a synthetic date far in the future (2100+), which
//       no sale can ever fall inside — which is also what pins cash sales at
//       exactly zero and turns "expected" into an equation with no unknowns.
//       A drawer cannot be deleted once opened, so a day the shop might
//       actually trade on is not the suite's to take.
//    2. The one assertion that genuinely needs a live window — a cash sale
//       reaching the drawer — measures the drawer THE SHOP has already
//       opened. If there isn't one it reports itself skipped rather than
//       opening today's (see ORGANZA_ALLOW_TODAY_DRAWER for a disposable
//       database).
// ============================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { expectCount, expectDelta, expectMoney } from "@tests/support/money";
import {
  allocateDate,
  closeSession,
  createExpense,
  dayAfter,
  expenseCategoryId,
  middleOfDay,
  openSessionRequest,
  openSyntheticSession,
  readSession,
  skipWithoutTodaysDrawer,
  todaysOpenSession,
} from "@tests/support/cash";
import { approveExpense } from "@tests/support/changeRequests";
import { collect, createPricedProduct, handToCourier, sell } from "@tests/support/verify";
import {
  DRAWER_CARD_EXPENSE,
  DRAWER_CASH_EXPENSE,
  DRAWER_CASH_SALE_QUANTITY,
  DRAWER_CASH_SALE_TOTAL,
  DRAWER_CASH_SALE_UNIT_PRICE,
  DRAWER_CLOSING_BALANCE,
  DRAWER_COUNTED,
  DRAWER_DIFFERENCE,
  DRAWER_EXPECTED_AFTER_BOTH,
  DRAWER_EXPECTED_AFTER_CASH_EXPENSE,
  DRAWER_NOTE,
  DRAWER_OPENING_FLOAT,
  DRAWER_SECOND_CASH_EXPENSE,
  DRAWER_WITHDRAWN,
} from "@tests/constants";
import type { CashSessionDto } from "@tests/types";

describe("Verify · the cash drawer", () => {
  let admin: string;
  let employee: string;
  let category: string;

  beforeAll(async () => {
    admin = (await getSession("ADMIN")).token;
    employee = (await getSession("EMPLOYEE")).token;
    category = await expenseCategoryId(admin);
  });

  describe("a whole day, from opening float to tomorrow's float", () => {
    // One session, walked in order — each step depends on the one before it,
    // which is the point: this is a day, not a set of unrelated assertions.
    let date: string;
    let session: CashSessionDto;

    it("opens with the float it was given, and expects exactly that", async () => {
      const opened = await openSyntheticSession(admin, { openingFloat: DRAWER_OPENING_FLOAT });
      date = opened.date;
      session = opened.session;

      expectMoney(session.openingFloat, DRAWER_OPENING_FLOAT, "opening float");
      expectMoney(session.cashSales, "0.00", "cash sales on a day nothing was sold");
      expectMoney(session.cashExpenses, "0.00", "cash expenses on a day nothing was spent");
      expectMoney(session.expected, DRAWER_OPENING_FLOAT, "expected = 400.00 + 0.00 − 0.00");
      expect(session.status, "a freshly opened drawer is OPEN").toBe("OPEN");
      expect(session.countedAmount, "and has not been counted").toBeNull();
    });

    it("subtracts a cash expense: 400.00 − 120.50 = 279.50", async () => {
      const spent = await createExpense(admin, {
        categoryId: category,
        amount: DRAWER_CASH_EXPENSE,
        date: middleOfDay(date),
        paidInCash: true,
        note: "[verify] cash out of the till",
      });
      expect(spent.status, "an Admin's own expense is approved as it is written").toBe(201);
      expect(spent.data!.approvalStatus).toBe("APPROVED");

      const after = await readSession(admin, session.id);
      expectMoney(after.cashExpenses, DRAWER_CASH_EXPENSE, "cash expenses");
      expectMoney(after.expected, DRAWER_EXPECTED_AFTER_CASH_EXPENSE, "expected after the cash expense");
    });

    it("ignores a card expense entirely — the drawer never held that money", async () => {
      const spent = await createExpense(admin, {
        categoryId: category,
        amount: DRAWER_CARD_EXPENSE,
        date: middleOfDay(date),
        paidInCash: false,
        note: "[verify] paid by transfer",
      });
      expect(spent.status).toBe(201);

      const after = await readSession(admin, session.id);
      expectMoney(after.cashExpenses, DRAWER_CASH_EXPENSE, "cash expenses (the 999.99 was not cash)");
      expectMoney(after.expected, DRAWER_EXPECTED_AFTER_CASH_EXPENSE, "expected after a non-cash expense");
    });

    it("ignores an expense still waiting for approval, and counts it the moment it is approved", async () => {
      const pending = await createExpense(employee, {
        categoryId: category,
        amount: DRAWER_SECOND_CASH_EXPENSE,
        date: middleOfDay(date),
        paidInCash: true,
        note: "[verify] employee's expense",
      });
      expect(pending.status, "an Employee may record an expense").toBe(201);
      expect(pending.data!.approvalStatus, "but it buys nothing until it is approved").toBe("PENDING");

      const whileWaiting = await readSession(admin, session.id);
      expectMoney(whileWaiting.cashExpenses, DRAWER_CASH_EXPENSE, "cash expenses while the request waits");
      expectMoney(whileWaiting.expected, DRAWER_EXPECTED_AFTER_CASH_EXPENSE, "expected while the request waits");

      const approved = await approveExpense(admin, pending.data!.id);
      expect(approved.status, "an Admin signs it off").toBe(200);

      const after = await readSession(admin, session.id);
      expectMoney(after.cashExpenses, "170.50", "cash expenses once approved (120.50 + 50.00)");
      expectMoney(after.expected, DRAWER_EXPECTED_AFTER_BOTH, "expected = 400.00 − 170.50");
    });

    it("refuses an unexplained difference — and hands back the three figures with the refusal", async () => {
      // The count is BLIND: the closing screen is never told what to expect,
      // so the refusal is what lets it reveal "expected 229.50, counted
      // 209.50, short 20.00" without ever having been given the answer.
      const refused = await closeSession(admin, session.id, { countedAmount: DRAWER_COUNTED });

      expect(refused.status, "a difference with no explanation is refused").toBe(400);
      expect(refused.error?.code).toBe("error.cashSession.difference_note_required");

      const details = refused.error?.details as { expected: string; counted: string; difference: string };
      expectMoney(details.expected, DRAWER_EXPECTED_AFTER_BOTH, "expected, revealed with the refusal");
      expectMoney(details.counted, DRAWER_COUNTED, "counted, revealed with the refusal");
      expectMoney(details.difference, DRAWER_DIFFERENCE, "difference, revealed with the refusal");

      const still = await readSession(admin, session.id);
      expect(still.status, "and the drawer is still open").toBe("OPEN");
    });

    it("records the count, the shortfall and the withdrawal — a difference never blocks the close", async () => {
      const closed = await closeSession(admin, session.id, {
        countedAmount: DRAWER_COUNTED,
        withdrawnAmount: DRAWER_WITHDRAWN,
        note: DRAWER_NOTE,
        carryDifference: true,
      });

      expect(closed.status, "with a note, the close goes through").toBe(200);
      expect(closed.data!.status).toBe("CLOSED");
      expectMoney(closed.data!.expected, DRAWER_EXPECTED_AFTER_BOTH, "expected, frozen onto the row");
      expectMoney(closed.data!.countedAmount, DRAWER_COUNTED, "counted");
      expectMoney(closed.data!.difference, DRAWER_DIFFERENCE, "difference (counted − expected)");
      expectMoney(closed.data!.withdrawnAmount, DRAWER_WITHDRAWN, "withdrawn");
      expectMoney(closed.data!.closingBalance, DRAWER_CLOSING_BALANCE, "left in the drawer (209.50 − 200.00)");
      expect(closed.data!.note, "the explanation is kept").toBe(DRAWER_NOTE);
      expect(closed.data!.differenceCarried, "and it was carried forward as a follow-up").toBe(true);
    });

    it("opens the next day on exactly what was left — 9.50, with nobody remembering a number", async () => {
      const tomorrow = await openSessionRequest(admin, { date: dayAfter(date), tzOffset: 0 });

      expect(tomorrow.status, "the next day opens").toBe(201);
      expectMoney(
        tomorrow.data!.openingFloat,
        DRAWER_CLOSING_BALANCE,
        "tomorrow's opening float (the COUNTED figure less the withdrawal, not the expected one)"
      );
      expectMoney(tomorrow.data!.expected, DRAWER_CLOSING_BALANCE, "and nothing has moved in it yet");
    });

    it("does not let a later expense rewrite the day somebody signed off", async () => {
      // Backdated into a window that has already been counted and closed.
      const late = await createExpense(admin, {
        categoryId: category,
        amount: "75.00",
        date: middleOfDay(date),
        paidInCash: true,
        note: "[verify] backdated after the close",
      });
      expect(late.status, "the expense itself is a legitimate record").toBe(201);

      const after = await readSession(admin, session.id);
      expectMoney(after.cashExpenses, "170.50", "cash expenses on the closed day (frozen)");
      expectMoney(after.expected, DRAWER_EXPECTED_AFTER_BOTH, "expected on the closed day (frozen)");
      expectMoney(after.difference, DRAWER_DIFFERENCE, "difference on the closed day (frozen)");
      expectMoney(after.closingBalance, DRAWER_CLOSING_BALANCE, "closing balance on the closed day (frozen)");
    });

    it("refuses to count a signed-off day a second time", async () => {
      const again = await closeSession(admin, session.id, { countedAmount: "1000.00", note: "[verify] retry" });
      expect(again.status, "a closed drawer is a signed record").toBe(409);
      expect(again.error?.code).toBe("error.cashSession.already_closed");

      const after = await readSession(admin, session.id);
      expectMoney(after.countedAmount, DRAWER_COUNTED, "the count that was recorded stands");
    });
  });

  describe("the arithmetic's own rules", () => {
    it("refuses to take more out of the drawer than was counted in it", async () => {
      const { session } = await openSyntheticSession(admin, { openingFloat: "100.00" });

      const res = await closeSession(admin, session.id, {
        countedAmount: "50.00",
        withdrawnAmount: "60.00",
        note: "[verify] impossible withdrawal",
      });
      expect(res.status, "you cannot take out what is not there").toBe(400);
      expect(res.error?.code).toBe("error.cashSession.withdrawal_exceeds_count");

      const still = await readSession(admin, session.id);
      expect(still.status, "and the drawer stays open").toBe("OPEN");
    });

    it("records an overage the same way it records a shortfall", async () => {
      const { session } = await openSyntheticSession(admin, { openingFloat: "200.00" });

      const closed = await closeSession(admin, session.id, {
        countedAmount: "215.00",
        note: "[verify] counted over",
      });
      expect(closed.status).toBe(200);
      expectMoney(closed.data!.difference, "15.00", "difference when the drawer is OVER");
      expectMoney(closed.data!.closingBalance, "215.00", "closing balance with no withdrawal");
    });

    it("closes a day that balances with no note at all", async () => {
      const { session } = await openSyntheticSession(admin, { openingFloat: "300.00" });

      const closed = await closeSession(admin, session.id, { countedAmount: "300.00" });
      expect(closed.status, "there is nothing to explain").toBe(200);
      expectMoney(closed.data!.difference, "0.00", "difference on a day that balanced");
      expect(closed.data!.differenceCarried, "and nothing to carry").toBe(false);
    });

    it("windows on the day: an expense dated into tomorrow does not touch today's drawer", async () => {
      const { session, date } = await openSyntheticSession(admin, { openingFloat: "500.00" });

      const outside = await createExpense(admin, {
        categoryId: category,
        amount: "42.00",
        date: middleOfDay(dayAfter(date)),
        paidInCash: true,
        note: "[verify] spent the day after",
      });
      expect(outside.status).toBe(201);

      const after = await readSession(admin, session.id);
      expectMoney(after.cashExpenses, "0.00", "cash expenses (the 42.00 belongs to the next day)");
      expectMoney(after.expected, "500.00", "expected is untouched by another day's spending");
    });
  });

  describe("a cash sale reaching the drawer", () => {
    it("adds exactly what was rung up: opening + 500.00 of cash sales", async (ctx) => {
      const drawer = await todaysOpenSession(admin);
      if (!skipWithoutTodaysDrawer(ctx, drawer)) return;

      const before = await readSession(admin, drawer.id);
      const product = await createPricedProduct(admin, {
        basePrice: DRAWER_CASH_SALE_UNIT_PRICE,
        stock: 10,
      });

      // 2 x 250.00, paid in cash, at the counter — collected the moment it is
      // rung up, so it lands in this window.
      const order = await sell(admin, [
        { productId: product.id, quantity: DRAWER_CASH_SALE_QUANTITY },
      ]);
      expectMoney(order.total, DRAWER_CASH_SALE_TOTAL, "the sale's own total");
      expect(order.paymentStatus, "a counter sale is paid on the spot").toBe("COLLECTED");

      const after = await readSession(admin, drawer.id);
      expectDelta(after.cashSales, before.cashSales, DRAWER_CASH_SALE_TOTAL, "cash sales in the drawer");
      expectDelta(after.expected, before.expected, DRAWER_CASH_SALE_TOTAL, "what the drawer should hold");

      // ...and the whole equation still adds up, on the absolute figures.
      const expected =
        Number(after.openingFloat) + Number(after.cashSales) - Number(after.cashExpenses);
      expectMoney(
        after.expected,
        expected.toFixed(2),
        "expected must equal openingFloat + cash sales − cash expenses"
      );
    });

    it("counts an online sale's cash on the day it is COLLECTED, not the day it was sold", async (ctx) => {
      const drawer = await todaysOpenSession(admin);
      if (!skipWithoutTodaysDrawer(ctx, drawer)) return;

      const product = await createPricedProduct(admin, { basePrice: "120.00", stock: 10 });

      // Sold and handed over, but not paid for: the delivery company holds
      // the money, so the drawer must not.
      const order = await sell(admin, [{ productId: product.id, quantity: 1 }], { channel: "WHATSAPP" });
      await handToCourier(admin, order.id);

      const whileOwed = await readSession(admin, drawer.id);
      const settled = await collect(admin, [order.id]);
      expect(settled.status, "an Admin records that the money arrived").toBe(200);
      expectCount(settled.data!.collectedIds.length, 1, "orders collected");

      const afterCollection = await readSession(admin, drawer.id);
      expectDelta(
        afterCollection.cashSales,
        whileOwed.cashSales,
        "120.00",
        "cash sales once the delivery company settled up"
      );
      expectDelta(
        afterCollection.expected,
        whileOwed.expected,
        "120.00",
        "what the drawer should hold once the money arrived"
      );
    });
  });

  describe("who may stand at the drawer", () => {
    it("keeps an Employee out of it entirely — reading and writing", async () => {
      // A synthetic date even here: if the gate ever broke, the refusal that
      // did not happen must still not land on a real trading day.
      const opening = await openSessionRequest(employee, {
        date: allocateDate(),
        tzOffset: 0,
        openingFloat: "10.00",
      });
      expect(opening.status, "an Employee must not open the drawer").toBe(403);
      expect(opening.error?.code).toBe("error.forbidden");

      const reading = await apiRequest("/api/cash-sessions/current", { token: employee });
      expect(reading.status, "nor read what is in it").toBe(403);
    });
  });
});
