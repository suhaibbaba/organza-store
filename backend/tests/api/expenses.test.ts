import { afterAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { createExpense, expenseCategoryId, num } from "@tests/support/cash";
import { approveChange, pendingChangeFor, rejectExpense } from "@tests/support/changeRequests";
import { DEFAULT_EXPENSE_CATEGORY_KEYS, ERROR_CODES } from "@/constants";
import type { ExpenseCategoryDto, ExpenseDto } from "@tests/types";

// Expenses (spec.md "Cash drawer & expenses") — the other half of the profit
// sum. Two rules carry the whole feature and are what this suite proves:
//
//   * ANYONE may record one, but an Employee's is a REQUEST: it opens PENDING
//     and counts for nothing until an Admin signs it off. Which of the two it
//     is depends on the caller's ROLE, never on the request body. The signing
//     off itself happens through the generic change-request flow (spec.md
//     "Employee change approvals"), which is where its tests live.
//   * Only APPROVED expenses are real money. (That they then reach the cash
//     drawer is asserted in cashDrawer.test.ts, where the drawer is.)
describe("Expenses", () => {
  const openedExpenseIds: string[] = [];
  const openedCategoryIds: string[] = [];

  async function expense(token: string, body: Record<string, unknown>) {
    const res = await createExpense(token, body);
    if (res.data?.id) openedExpenseIds.push(res.data.id);
    return res;
  }

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    for (const id of openedExpenseIds) {
      await apiRequest(`/api/expenses/${id}`, { method: "DELETE", token: admin.token });
    }
    for (const id of openedCategoryIds) {
      await apiRequest(`/api/expense-categories/${id}`, { method: "DELETE", token: admin.token });
    }
  });

  // -------------------------------------------------------------------------
  // Recording
  // -------------------------------------------------------------------------
  describe("recording", () => {
    it("approves an Admin's own expense as it is written", async () => {
      const admin = await getSession("ADMIN");
      const categoryId = await expenseCategoryId(admin.token);

      const res = await expense(admin.token, {
        categoryId,
        amount: "125.50",
        note: `Vitest expense ${uniqueId()}`,
        paidInCash: true,
        isRecurring: true,
      });

      expect(res.status).toBe(201);
      // Someone who could approve it anyway has nothing to wait for.
      expect(res.data!.approvalStatus).toBe("APPROVED");
      expect(res.data!.approvedBy?.id).toBe(admin.userId);
      expect(res.data!.approvedAt).not.toBeNull();
      expect(num(res.data!.amount)).toBe(125.5);
      expect(res.data!.paidInCash).toBe(true);
      expect(res.data!.isRecurring).toBe(true);
      expect(res.data!.createdBy?.id).toBe(admin.userId);
      // Dated to now when nothing else is said.
      expect(Number.isNaN(Date.parse(res.data!.date))).toBe(false);
    });

    it("approves a Manager's own expense too", async () => {
      const manager = await getSession("MANAGER");
      const categoryId = await expenseCategoryId(manager.token);

      const res = await expense(manager.token, { categoryId, amount: "40" });
      expect(res.status).toBe(201);
      expect(res.data!.approvalStatus).toBe("APPROVED");
    });

    it("opens an Employee's expense as a pending request", async () => {
      const employee = await getSession("EMPLOYEE");
      const categoryId = await expenseCategoryId(employee.token);

      const res = await expense(employee.token, {
        categoryId,
        amount: "75",
        note: "أكياس تغليف",
        paidInCash: true,
      });

      expect(res.status).toBe(201);
      expect(res.data!.approvalStatus).toBe("PENDING");
      expect(res.data!.approvedBy).toBeNull();
      expect(res.data!.approvedAt).toBeNull();
      expect(res.data!.createdBy?.id).toBe(employee.userId);
    });

    it("decides the approval from the caller's role, not from the request body", async () => {
      const employee = await getSession("EMPLOYEE");
      const categoryId = await expenseCategoryId(employee.token);

      // Asking to be approved is not a way of being approved — otherwise
      // "record an expense" would be a way to approve one. It used to be
      // ignored; it is now refused outright (middleware/validate.ts), which
      // says the same thing out loud.
      const asking = await expense(employee.token, {
        categoryId,
        amount: "20",
        approvalStatus: "APPROVED",
        approvedById: employee.userId,
      });

      expect(asking.status).toBe(400);
      expect(asking.error?.code).toBe(ERROR_CODES.VALIDATION);

      // ...and what the role actually decides is unchanged: an Employee's
      // expense opens PENDING and has approved nothing.
      const res = await expense(employee.token, { categoryId, amount: "20" });

      expect(res.status).toBe(201);
      expect(res.data!.approvalStatus).toBe("PENDING");
      expect(res.data!.approvedBy).toBeNull();
    });

    it("keeps the date the money was actually spent, not the date it was entered", async () => {
      const admin = await getSession("ADMIN");
      const categoryId = await expenseCategoryId(admin.token);

      // A bill paid on the 30th and entered on the 2nd belongs to the 30th.
      const res = await expense(admin.token, { categoryId, amount: "310", date: "2099-11-30" });
      expect(res.status).toBe(201);
      expect(res.data!.date.slice(0, 10)).toBe("2099-11-30");
    });

    it("refuses an amount that is not real money, and an unknown category", async () => {
      const admin = await getSession("ADMIN");
      const categoryId = await expenseCategoryId(admin.token);

      for (const amount of ["0", "-5", "abc"]) {
        const res = await createExpense(admin.token, { categoryId, amount });
        expect(res.status).toBe(400);
        expect(res.error?.code).toBe(ERROR_CODES.VALIDATION);
      }

      const unknown = await createExpense(admin.token, { categoryId: "no-such-category", amount: "10" });
      expect(unknown.status).toBe(400);
      expect(unknown.error?.code).toBe(ERROR_CODES.EXPENSE_CATEGORY_NOT_FOUND);
    });
  });

  // -------------------------------------------------------------------------
  // Approval
  // -------------------------------------------------------------------------
  // The approval itself lives in the generic change-request flow now (spec.md
  // "Employee change approvals") — there is one approval mechanism in the
  // shop, not an expense-shaped one beside everything else. What an expense
  // still owns is its APPLIED state: approvalStatus/approvedBy, which every
  // money query filters on.
  describe("approval", () => {
    it("files a change request for an Employee's expense, and applies it on approval", async () => {
      const employee = await getSession("EMPLOYEE");
      const admin = await getSession("ADMIN");
      const categoryId = await expenseCategoryId(employee.token);

      const created = await expense(employee.token, { categoryId, amount: "55", paidInCash: true });
      expect(created.data!.approvalStatus).toBe("PENDING");
      // The request comes straight back, so the screen that recorded it can
      // say it is waiting rather than leaving the person guessing.
      expect(created.data!.pendingChange?.status).toBe("PENDING");
      expect(created.data!.pendingChange?.requestedById).toBe(employee.userId);

      const pending = await pendingChangeFor(admin.token, "Expense", created.data!.id);
      expect(pending).toBeDefined();
      expect(pending!.field).toBe("approvalStatus");

      const approved = await approveChange(admin.token, pending!.id);
      expect(approved.status).toBe(200);
      expect(approved.data!.status).toBe("APPROVED");
      expect(approved.data!.decidedBy?.id).toBe(admin.userId);

      const reread = await apiRequest<ExpenseDto>(`/api/expenses/${created.data!.id}`, { token: admin.token });
      expect(reread.data!.approvalStatus).toBe("APPROVED");
      expect(reread.data!.approvedBy?.id).toBe(admin.userId);
      expect(reread.data!.approvedAt).not.toBeNull();

      // Deciding it again would silently overwrite who decided what — the one
      // thing the record exists to hold.
      const again = await approveChange(admin.token, pending!.id);
      expect(again.status).toBe(409);
      expect(again.error?.code).toBe(ERROR_CODES.CHANGE_REQUEST_NOT_PENDING);
    });

    it("records a rejection with its reason instead of making it vanish", async () => {
      const employee = await getSession("EMPLOYEE");
      const admin = await getSession("ADMIN");
      const categoryId = await expenseCategoryId(employee.token);

      const created = await expense(employee.token, { categoryId, amount: "90", note: "تصليح" });

      const rejected = await rejectExpense(admin.token, created.data!.id, "مسجّلة مرتين");
      expect(rejected.status).toBe(200);
      expect(rejected.data!.status).toBe("REJECTED");
      expect(rejected.data!.decidedBy?.id).toBe(admin.userId);
      // The reason stays on the decision rather than being appended to what
      // the person who recorded the expense wrote.
      expect(rejected.data!.decisionNote).toBe("مسجّلة مرتين");

      const reread = await apiRequest<ExpenseDto>(`/api/expenses/${created.data!.id}`, { token: admin.token });
      // Rejected on the expense too — a refused expense says so on its own
      // row rather than sitting pending forever — and its own note is intact.
      expect(reread.data!.approvalStatus).toBe("REJECTED");
      expect(reread.data!.approvedBy?.id).toBe(admin.userId);
      expect(reread.data!.note).toBe("تصليح");

      const approveAfter = await approveChange(admin.token, rejected.data!.id);
      expect(approveAfter.status).toBe(409);
    });

    it("does not let an Employee approve anything, including their own", async () => {
      const employee = await getSession("EMPLOYEE");
      const admin = await getSession("ADMIN");
      const categoryId = await expenseCategoryId(employee.token);

      const created = await expense(employee.token, { categoryId, amount: "30" });
      const pending = await pendingChangeFor(admin.token, "Expense", created.data!.id);

      const res = await approveChange(employee.token, pending!.id);
      expect(res.status).toBe(403);
      expect(res.error?.code).toBe(ERROR_CODES.FORBIDDEN);

      // ...and it really is untouched.
      const reread = await apiRequest<ExpenseDto>(`/api/expenses/${created.data!.id}`, { token: admin.token });
      expect(reread.data!.approvalStatus).toBe("PENDING");
    });

    // Approving is Admin-only now (changeRequest.approve). A Manager still
    // records spending that counts immediately — they hold expense.approve,
    // so their own expense never becomes a request at all — but signing off
    // somebody ELSE's is the Admin's.
    it("does not let a Manager decide an Employee's expense", async () => {
      const employee = await getSession("EMPLOYEE");
      const manager = await getSession("MANAGER");
      const admin = await getSession("ADMIN");
      const categoryId = await expenseCategoryId(employee.token);

      const created = await expense(employee.token, { categoryId, amount: "44" });
      const pending = await pendingChangeFor(admin.token, "Expense", created.data!.id);

      const res = await approveChange(manager.token, pending!.id);
      expect(res.status).toBe(403);
      expect(res.error?.code).toBe(ERROR_CODES.FORBIDDEN);
    });
  });

  // -------------------------------------------------------------------------
  // Reading, editing, deleting
  // -------------------------------------------------------------------------
  describe("the list", () => {
    it("keeps an Employee out of the expense list", async () => {
      const employee = await getSession("EMPLOYEE");

      const list = await apiRequest("/api/expenses", { token: employee.token });
      expect(list.status).toBe(403);
      expect(list.error?.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it("paginates, filters and sorts (CLAUDE.md rule 15)", async () => {
      const admin = await getSession("ADMIN");
      const categoryId = await expenseCategoryId(admin.token, "supplies");
      await expense(admin.token, { categoryId, amount: "11", paidInCash: false, isRecurring: false });

      const res = await apiRequest<ExpenseDto[]>(
        `/api/expenses?categoryId=${categoryId}&paidInCash=false&page=1&pageSize=5&sortBy=amount&sortDir=asc`,
        { token: admin.token }
      );
      expect(res.status).toBe(200);
      expect(res.meta?.pageSize).toBe(5);
      expect(res.data!.length).toBeLessThanOrEqual(5);
      for (const entry of res.data!) {
        expect(entry.categoryId).toBe(categoryId);
        expect(entry.paidInCash).toBe(false);
      }
    });

    it("lets an Admin edit and soft-delete an expense", async () => {
      const admin = await getSession("ADMIN");
      const categoryId = await expenseCategoryId(admin.token);
      const created = await expense(admin.token, { categoryId, amount: "10" });

      const updated = await apiRequest<ExpenseDto>(`/api/expenses/${created.data!.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { amount: "12.75", note: "corrected" },
      });
      expect(updated.status).toBe(200);
      expect(num(updated.data!.amount)).toBe(12.75);

      const deleted = await apiRequest(`/api/expenses/${created.data!.id}`, {
        method: "DELETE",
        token: admin.token,
      });
      expect(deleted.status).toBe(200);

      // Hidden from every endpoint, not destroyed (the same rule as orders).
      const reread = await apiRequest(`/api/expenses/${created.data!.id}`, { token: admin.token });
      expect(reread.status).toBe(404);
      expect(reread.error?.code).toBe(ERROR_CODES.EXPENSE_NOT_FOUND);
    });

    it("does not let an Employee edit or delete one", async () => {
      const admin = await getSession("ADMIN");
      const employee = await getSession("EMPLOYEE");
      const categoryId = await expenseCategoryId(admin.token);
      const created = await expense(admin.token, { categoryId, amount: "10" });

      const patched = await apiRequest(`/api/expenses/${created.data!.id}`, {
        method: "PATCH",
        token: employee.token,
        body: { amount: "1" },
      });
      expect(patched.status).toBe(403);

      const deleted = await apiRequest(`/api/expenses/${created.data!.id}`, {
        method: "DELETE",
        token: employee.token,
      });
      expect(deleted.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // Categories — the shop's own list
  // -------------------------------------------------------------------------
  describe("categories", () => {
    it("ships the five the shop starts with, readable by every role", async () => {
      for (const role of ["ADMIN", "MANAGER", "EMPLOYEE"] as const) {
        const session = await getSession(role);
        const res = await apiRequest<ExpenseCategoryDto[]>("/api/expense-categories", { token: session.token });

        expect(res.status).toBe(200);
        const keys = res.data!.map((category) => category.key);
        // Picking a category is part of recording an expense, which every
        // role may do — so every role may read the list.
        for (const key of DEFAULT_EXPENSE_CATEGORY_KEYS) {
          expect(keys).toContain(key);
        }
      }
    });

    it("lets a Manager add one and rename it, but freezes its key", async () => {
      const manager = await getSession("MANAGER");
      const key = `vitest-${uniqueId()}`;

      const created = await apiRequest<ExpenseCategoryDto>("/api/expense-categories", {
        method: "POST",
        token: manager.token,
        body: { key, name: { ar: "إيجار", en: "Rent" } },
      });
      expect(created.status).toBe(201);
      openedCategoryIds.push(created.data!.id);
      expect(created.data!.key).toBe(key);

      // The key is frozen, and trying to move it is now refused rather than
      // ignored (middleware/validate.ts) — an unknown field is an answer, not
      // something to swallow.
      const reKeyed = await apiRequest(`/api/expense-categories/${created.data!.id}`, {
        method: "PATCH",
        token: manager.token,
        body: { name: { ar: "إيجار المحل", en: "Shop rent" }, key: "hacked" },
      });
      expect(reKeyed.status).toBe(400);
      expect(reKeyed.error?.code).toBe(ERROR_CODES.VALIDATION);

      // A rename reaches every expense filed under it automatically, because
      // nothing copies the name (CLAUDE.md rule 2/9) — and the key it is
      // identified by does not move.
      const renamed = await apiRequest<ExpenseCategoryDto>(`/api/expense-categories/${created.data!.id}`, {
        method: "PATCH",
        token: manager.token,
        body: { name: { ar: "إيجار المحل", en: "Shop rent" } },
      });
      expect(renamed.status).toBe(200);
      expect(renamed.data!.name.en).toBe("Shop rent");
      expect(renamed.data!.key).toBe(key);

      const duplicate = await apiRequest("/api/expense-categories", {
        method: "POST",
        token: manager.token,
        body: { key, name: { ar: "مكرر" } },
      });
      expect(duplicate.status).toBe(409);
      expect(duplicate.error?.code).toBe(ERROR_CODES.EXPENSE_CATEGORY_KEY_DUPLICATE);
    });

    it("refuses to delete a category that expenses are filed under", async () => {
      const admin = await getSession("ADMIN");
      const key = `vitest-${uniqueId()}`;

      const created = await apiRequest<ExpenseCategoryDto>("/api/expense-categories", {
        method: "POST",
        token: admin.token,
        body: { key, name: { ar: "تجربة" } },
      });
      const categoryId = created.data!.id;
      openedCategoryIds.push(categoryId);

      const filed = await expense(admin.token, { categoryId, amount: "5" });

      const refused = await apiRequest(`/api/expense-categories/${categoryId}`, {
        method: "DELETE",
        token: admin.token,
      });
      expect(refused.status).toBe(409);
      expect(refused.error?.code).toBe(ERROR_CODES.EXPENSE_CATEGORY_HAS_EXPENSES);

      // Retiring it is what the shop does instead: out of the picker, still
      // on the record.
      const retired = await apiRequest<ExpenseCategoryDto>(`/api/expense-categories/${categoryId}`, {
        method: "PATCH",
        token: admin.token,
        body: { isActive: false },
      });
      expect(retired.data!.isActive).toBe(false);

      const active = await apiRequest<ExpenseCategoryDto[]>("/api/expense-categories", { token: admin.token });
      expect(active.data!.some((category) => category.id === categoryId)).toBe(false);

      const all = await apiRequest<ExpenseCategoryDto[]>("/api/expense-categories?includeInactive=true", {
        token: admin.token,
      });
      expect(all.data!.some((category) => category.id === categoryId)).toBe(true);

      // Clean-up ordering: the expense has to go before the category can.
      await apiRequest(`/api/expenses/${filed.data!.id}`, { method: "DELETE", token: admin.token });
    });

    it("does not let an Employee change the list", async () => {
      const employee = await getSession("EMPLOYEE");

      const res = await apiRequest("/api/expense-categories", {
        method: "POST",
        token: employee.token,
        body: { key: `vitest-${uniqueId()}`, name: { ar: "ممنوع" } },
      });
      expect(res.status).toBe(403);
      expect(res.error?.code).toBe(ERROR_CODES.FORBIDDEN);
    });
  });
});
