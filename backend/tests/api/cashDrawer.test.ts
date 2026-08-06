import { afterAll, describe, expect, it } from "vitest";
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { createSellableProduct } from "@tests/support/orders";
import {
  closeSession,
  createExpense,
  expenseCategoryId,
  middleOfDay,
  num,
  openSessionRequest,
  openSyntheticSession,
  readCurrent,
  readSession,
  todaysOpenSession,
} from "@tests/support/cash";
import { ERROR_CODES } from "@/constants";
import type { CashSessionDto, ExpenseDto, OrderDto } from "@tests/types";

// The cash drawer (spec.md "Cash drawer & expenses").
//
//   expected   = openingFloat + cash sales - cash expenses
//   difference = counted - expected
//   tomorrow's openingFloat = counted - withdrawn
//
// Most of this is proved on SYNTHETIC days far in the future, where no order
// can ever have been collected: cash sales are then exactly zero, and the
// equation has no unknowns left in it. Only the "a real sale reaches the
// drawer" case needs today's session, and it is asserted as a delta.
describe("Cash drawer", () => {
  const openedOrderIds: string[] = [];
  const openedProductIds: string[] = [];
  const openedExpenseIds: string[] = [];

  async function sellableProduct(token: string, options?: Parameters<typeof createSellableProduct>[1]) {
    const product = await createSellableProduct(token, options);
    openedProductIds.push(product.id);
    return product;
  }

  async function expense(token: string, body: Record<string, unknown>) {
    const res = await createExpense(token, body);
    if (res.data?.id) openedExpenseIds.push(res.data.id);
    return res;
  }

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    // Expenses are cleaned up because they are dated into windows other
    // tests measure; the sessions themselves sit on days nothing else uses.
    for (const id of openedExpenseIds) {
      await apiRequest(`/api/expenses/${id}`, { method: "DELETE", token: admin.token });
    }
    for (const id of openedOrderIds) {
      await apiRequest(`/api/orders/${id}`, { method: "DELETE", token: admin.token });
    }
    for (const id of openedProductIds) {
      await apiRequest(`/api/products/${id}`, { method: "DELETE", token: admin.token });
    }
  });

  // -------------------------------------------------------------------------
  // expected vs. counted
  // -------------------------------------------------------------------------
  describe("expected vs. counted", () => {
    it("opens with the float it was given and expects exactly that when nothing has moved", async () => {
      const admin = await getSession("ADMIN");
      const { session } = await openSyntheticSession(admin.token, { openingFloat: "250" });

      expect(session.status).toBe("OPEN");
      expect(num(session.openingFloat)).toBe(250);
      expect(num(session.cashSales)).toBe(0);
      expect(num(session.cashExpenses)).toBe(0);
      expect(num(session.expected)).toBe(250);
      expect(session.countedAmount).toBeNull();

      // Closing on the nose: no difference, and therefore no note needed.
      const closed = await closeSession(admin.token, session.id, { countedAmount: "250" });
      expect(closed.status).toBe(200);
      expect(closed.data!.status).toBe("CLOSED");
      expect(num(closed.data!.difference)).toBe(0);
      expect(closed.data!.closedBy?.id).toBe(admin.userId);
    });

    it("subtracts a cash expense from what the drawer should hold, and ignores a non-cash one", async () => {
      const admin = await getSession("ADMIN");
      const categoryId = await expenseCategoryId(admin.token);
      const { session, date } = await openSyntheticSession(admin.token, { openingFloat: "500" });

      // Both are real costs. Only the one paid out of the till moves the
      // drawer (spec.md: "a transfer never touched the drawer").
      await expense(admin.token, {
        categoryId,
        amount: "120",
        date: middleOfDay(date),
        paidInCash: true,
        note: "cash out of the till",
      });
      await expense(admin.token, {
        categoryId,
        amount: "900",
        date: middleOfDay(date),
        paidInCash: false,
        note: "bank transfer",
      });

      const reread = await readSession(admin.token, session.id);
      expect(num(reread.cashExpenses)).toBe(120);
      expect(num(reread.expected)).toBe(380); // 500 - 120, the transfer untouched

      const closed = await closeSession(admin.token, session.id, { countedAmount: "380" });
      expect(num(closed.data!.difference)).toBe(0);
    });

    it("ignores an expense that is still awaiting approval, and counts it once approved", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const categoryId = await expenseCategoryId(employee.token);
      const { session, date } = await openSyntheticSession(admin.token, { openingFloat: "400" });

      // An Employee's expense is a request, not a payout.
      const pending = await expense(employee.token, {
        categoryId,
        amount: "60",
        date: middleOfDay(date),
        paidInCash: true,
      });
      expect(pending.data!.approvalStatus).toBe("PENDING");

      expect(num((await readSession(admin.token, session.id)).expected)).toBe(400);

      await apiRequest<ExpenseDto>(`/api/expenses/${pending.data!.id}/approve`, {
        method: "POST",
        token: admin.token,
      });

      expect(num((await readSession(admin.token, session.id)).expected)).toBe(340);

      await closeSession(admin.token, session.id, { countedAmount: "340" });
    });

    it("records a shortfall rather than refusing the close — but insists on a note", async () => {
      const admin = await getSession("ADMIN");
      const { session } = await openSyntheticSession(admin.token, { openingFloat: "300" });

      // The count disagrees. Without an explanation the close is refused...
      const unexplained = await closeSession(admin.token, session.id, { countedAmount: "275" });
      expect(unexplained.status).toBe(400);
      expect(unexplained.error?.code).toBe(ERROR_CODES.CASH_SESSION_DIFFERENCE_NOTE_REQUIRED);

      // ...and the drawer is still open, not half-closed.
      expect((await readSession(admin.token, session.id)).status).toBe("OPEN");

      // ...but with one, the shortfall is SAVED. It is never a reason to
      // block: the money in the drawer is a fact.
      const explained = await closeSession(admin.token, session.id, {
        countedAmount: "275",
        note: "نقص ٢٥ شيكل — يُراجع",
      });
      expect(explained.status).toBe(200);
      expect(num(explained.data!.countedAmount)).toBe(275);
      expect(num(explained.data!.expected)).toBe(300);
      expect(num(explained.data!.difference)).toBe(-25);
      expect(explained.data!.note).toBe("نقص ٢٥ شيكل — يُراجع");
    });

    it("records an overage the same way", async () => {
      const admin = await getSession("ADMIN");
      const { session } = await openSyntheticSession(admin.token, { openingFloat: "100" });

      const closed = await closeSession(admin.token, session.id, {
        countedAmount: "140",
        note: "زيادة ٤٠ — يُراجع",
      });
      expect(closed.status).toBe(200);
      expect(num(closed.data!.difference)).toBe(40);
    });

    it("refuses to count a drawer twice", async () => {
      const admin = await getSession("ADMIN");
      const { session } = await openSyntheticSession(admin.token, { openingFloat: "50" });

      expect((await closeSession(admin.token, session.id, { countedAmount: "50" })).status).toBe(200);

      const again = await closeSession(admin.token, session.id, { countedAmount: "999" });
      expect(again.status).toBe(409);
      expect(again.error?.code).toBe(ERROR_CODES.CASH_SESSION_ALREADY_CLOSED);
      // ...and the signed-off figures are untouched.
      expect(num((await readSession(admin.token, session.id)).countedAmount)).toBe(50);
    });

    it("refuses a second drawer on a date that already has one", async () => {
      const admin = await getSession("ADMIN");
      const { session, date } = await openSyntheticSession(admin.token, { openingFloat: "10" });

      const duplicate = await openSessionRequest(admin.token, { date, tzOffset: 0 });
      expect(duplicate.status).toBe(409);
      expect(duplicate.error?.code).toBe(ERROR_CODES.CASH_SESSION_DATE_TAKEN);

      await closeSession(admin.token, session.id, { countedAmount: "10" });
    });
  });

  // -------------------------------------------------------------------------
  // The withdrawal, and what it leaves behind
  // -------------------------------------------------------------------------
  describe("withdrawal and carry-over", () => {
    it("carries what is left in the drawer into the next day's opening float", async () => {
      const admin = await getSession("ADMIN");

      // Day one: opens with 200, closes counted at 200, and 150 is banked.
      const dayOne = await openSyntheticSession(admin.token, { openingFloat: "200" });
      const closed = await closeSession(admin.token, dayOne.session.id, {
        countedAmount: "200",
        withdrawnAmount: "150",
      });
      expect(closed.status).toBe(200);
      expect(num(closed.data!.withdrawnAmount)).toBe(150);
      // 200 counted - 150 banked = 50 left in the drawer overnight.
      expect(num(closed.data!.closingBalance)).toBe(50);

      // Day two opens with NO openingFloat given — the remainder carries
      // itself over, which is the whole point of recording the withdrawal.
      const dayTwo = await openSyntheticSession(admin.token);
      expect(num(dayTwo.session.openingFloat)).toBe(50);
      expect(num(dayTwo.session.expected)).toBe(50);

      await closeSession(admin.token, dayTwo.session.id, { countedAmount: "50" });
    });

    it("carries the COUNTED figure, not the expected one, when a day came up short", async () => {
      const admin = await getSession("ADMIN");

      // Short by 30, explained and closed. Nothing is banked.
      const dayOne = await openSyntheticSession(admin.token, { openingFloat: "130" });
      const closed = await closeSession(admin.token, dayOne.session.id, {
        countedAmount: "100",
        note: "قصير ٣٠",
      });
      expect(num(closed.data!.difference)).toBe(-30);
      expect(num(closed.data!.closingBalance)).toBe(100);

      // The next day opens on the money that is really there (100), not on
      // what the books said should have been (130) — so no correcting entry
      // is ever needed, only an explanation.
      const dayTwo = await openSyntheticSession(admin.token);
      expect(num(dayTwo.session.openingFloat)).toBe(100);

      await closeSession(admin.token, dayTwo.session.id, { countedAmount: "100" });
    });

    it("refuses to take more out of the drawer than was counted in it", async () => {
      const admin = await getSession("ADMIN");
      const { session } = await openSyntheticSession(admin.token, { openingFloat: "80" });

      const res = await closeSession(admin.token, session.id, {
        countedAmount: "80",
        withdrawnAmount: "81",
      });
      expect(res.status).toBe(400);
      expect(res.error?.code).toBe(ERROR_CODES.CASH_SESSION_WITHDRAWAL_EXCEEDS_COUNT);

      await closeSession(admin.token, session.id, { countedAmount: "80" });
    });

    it("lets an explicit opening float override the carry-over", async () => {
      const admin = await getSession("ADMIN");

      const dayOne = await openSyntheticSession(admin.token, { openingFloat: "70" });
      await closeSession(admin.token, dayOne.session.id, { countedAmount: "70" });

      const dayTwo = await openSyntheticSession(admin.token, { openingFloat: "500" });
      expect(num(dayTwo.session.openingFloat)).toBe(500);

      await closeSession(admin.token, dayTwo.session.id, { countedAmount: "500" });
    });
  });

  // -------------------------------------------------------------------------
  // Carrying a difference forward
  // -------------------------------------------------------------------------
  describe("follow-up on a difference", () => {
    it("keeps a carried difference on the follow-up list until it is signed off", async () => {
      const admin = await getSession("ADMIN");
      const before = await readCurrent(admin.token);
      const { session } = await openSyntheticSession(admin.token, { openingFloat: "90" });

      const closed = await closeSession(admin.token, session.id, {
        countedAmount: "60",
        note: "ناقص ٣٠ — يُتابع غدًا",
        carryDifference: true,
      });
      expect(closed.status).toBe(200);
      expect(closed.data!.differenceCarried).toBe(true);
      expect(closed.data!.followUpResolvedAt).toBeNull();

      // It shows up as an outstanding follow-up...
      const during = await readCurrent(admin.token);
      expect(during.data!.openFollowUpCount).toBe(before.data!.openFollowUpCount + 1);

      const list = await apiRequest<CashSessionDto[]>("/api/cash-sessions?openFollowUpOnly=true&pageSize=100", {
        token: admin.token,
      });
      expect(list.data!.some((entry) => entry.id === session.id)).toBe(true);

      // ...and drops off it once someone has worked out what happened.
      const resolved = await apiRequest<CashSessionDto>(`/api/cash-sessions/${session.id}/resolve-follow-up`, {
        method: "POST",
        token: admin.token,
      });
      expect(resolved.status).toBe(200);
      expect(resolved.data!.followUpResolvedAt).not.toBeNull();
      expect(resolved.data!.followUpResolvedBy?.id).toBe(admin.userId);

      const after = await readCurrent(admin.token);
      expect(after.data!.openFollowUpCount).toBe(before.data!.openFollowUpCount);

      // Signing the same one off twice is not a no-op — it would overwrite
      // who decided what.
      const again = await apiRequest(`/api/cash-sessions/${session.id}/resolve-follow-up`, {
        method: "POST",
        token: admin.token,
      });
      expect(again.status).toBe(409);
      expect(again.error?.code).toBe(ERROR_CODES.CASH_SESSION_NO_OPEN_FOLLOW_UP);
    });

    it("does not carry anything when the drawer balanced", async () => {
      const admin = await getSession("ADMIN");
      const { session } = await openSyntheticSession(admin.token, { openingFloat: "40" });

      const closed = await closeSession(admin.token, session.id, {
        countedAmount: "40",
        carryDifference: true,
      });
      // Nothing to carry: there was no difference.
      expect(closed.data!.differenceCarried).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // A real sale reaching a real drawer — the one case a synthetic day cannot
  // cover, so it is a delta on today's session.
  // -------------------------------------------------------------------------
  describe("cash sales", () => {
    it("adds a cash counter sale to what the drawer should hold", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "60", stock: 5 });

      const before = await todaysOpenSession(admin.token);

      const sale = await apiRequest<OrderDto>("/api/orders", {
        method: "POST",
        token: admin.token,
        body: { channel: "STORE", items: [{ productId: product.id, quantity: 2 }] },
      });
      expect(sale.status).toBe(201);
      openedOrderIds.push(sale.data!.id);

      const after = await readSession(admin.token, before.id);
      // A counter sale is cash in hand the moment it is rung up.
      expect(num(after.cashSales) - num(before.cashSales)).toBeCloseTo(120, 2);
      expect(num(after.expected) - num(before.expected)).toBeCloseTo(120, 2);
    });

    it("counts an online order's cash on the day it is collected, not the day it was sold", async () => {
      const admin = await getSession("ADMIN");
      const product = await sellableProduct(admin.token, { basePrice: "45", stock: 5 });

      const order = await apiRequest<OrderDto>("/api/orders", {
        method: "POST",
        token: admin.token,
        body: {
          channel: "WHATSAPP",
          customerName: "لمى",
          customerPhone: "+970599123321",
          items: [{ productId: product.id, quantity: 1 }],
        },
      });
      expect(order.status).toBe(201);
      openedOrderIds.push(order.data!.id);

      // Sold, but the delivery company is still holding the money: nothing
      // has reached the drawer.
      const before = await todaysOpenSession(admin.token);

      const collected = await apiRequest("/api/orders/collect", {
        method: "POST",
        token: admin.token,
        body: { orderIds: [order.data!.id] },
      });
      expect(collected.status).toBe(200);

      const after = await readSession(admin.token, before.id);
      expect(num(after.cashSales) - num(before.cashSales)).toBeCloseTo(45, 2);
    });
  });

  // -------------------------------------------------------------------------
  // Role gating (CLAUDE.md rule 5) — enforced on the backend, not the UI
  // -------------------------------------------------------------------------
  describe("role gating", () => {
    it("keeps an Employee out of the drawer entirely", async () => {
      const employee = await getSession("EMPLOYEE");

      const current = await readCurrent(employee.token);
      expect(current.status).toBe(403);
      expect(current.error?.code).toBe(ERROR_CODES.FORBIDDEN);

      const list = await apiRequest("/api/cash-sessions", { token: employee.token });
      expect(list.status).toBe(403);

      // The person at the till must not be the one who declares what should
      // have been in it (spec.md "Security rationale").
      const open = await openSessionRequest(employee.token, { tzOffset: 0 });
      expect(open.status).toBe(403);
      expect(open.error?.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it("lets a Manager open and close a drawer", async () => {
      const manager = await getSession("MANAGER");
      const { session } = await openSyntheticSession(manager.token, { openingFloat: "20" });

      expect(session.openedBy?.id).toBe(manager.userId);

      const closed = await closeSession(manager.token, session.id, { countedAmount: "20" });
      expect(closed.status).toBe(200);
    });

    it("refuses an unauthenticated caller", async () => {
      const res = await readCurrent("");
      expect(res.status).toBe(401);
      expect(res.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });
  });
});
