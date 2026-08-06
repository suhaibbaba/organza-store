import { Router } from "express";
import { AuditAction, Prisma } from "@prisma/client";
import { can } from "@shared/lib/permissions";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody, validateQuery } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import { serializeExpense } from "@/lib/expenses";
import { writeAudit } from "@/lib/audit";
import {
  createExpenseSchema,
  listExpensesQuerySchema,
  rejectExpenseSchema,
  updateExpenseSchema,
  type CreateExpenseInput,
  type ListExpensesQuery,
  type RejectExpenseInput,
  type UpdateExpenseInput,
} from "@/validation/expense";
import {
  APPROVED_EXPENSE_APPROVAL_STATUS,
  AUDIT_ENTITY,
  ERROR_CODES,
  PENDING_EXPENSE_APPROVAL_STATUS,
} from "@/constants";
import type { ExpenseApprovalStatus } from "@/types";

// Expenses (spec.md "Cash drawer & expenses") — the other half of the profit
// sum: orders say what came in, these say what went out.
//
// The gates, all enforced here rather than in the UI:
//   * expense.create  — every role. Whoever pays the electricity bill should
//                       be able to write it down there and then.
//   * expense.view    — Admin/Manager. The expense list is the shop's
//                       spending laid bare.
//   * expense.manage  — Admin/Manager. Editing or deleting after the fact.
//   * expense.approve — Admin/Manager. Signing off someone else's.
//
// And the rule that makes "anyone can record one" safe: an expense recorded
// by someone WITHOUT expense.approve opens PENDING and counts for nothing —
// not against the drawer, not against profit — until it is approved. That is
// decided by the caller's role, never by the request body.
const router = Router();
router.use(requireAuth);

const expenseInclude = {
  category: { select: { id: true, key: true, name: true } },
  // Just id + name of whoever recorded/signed it off — nothing else about a
  // staff member belongs on a financial record (CLAUDE.md rule 19).
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
} satisfies Prisma.ExpenseInclude;

async function loadExpense(id: string) {
  const expense = await prisma.expense.findFirst({ where: { id, deletedAt: null }, include: expenseInclude });
  if (!expense) throw new AppError(404, ERROR_CODES.EXPENSE_NOT_FOUND);
  return expense;
}

async function requireCategory(categoryId: string): Promise<void> {
  const category = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new AppError(400, ERROR_CODES.EXPENSE_CATEGORY_NOT_FOUND);
}

// ---------------------------------------------------------------------------
// GET /api/expenses — list (pagination + filtering + sorting)
// ---------------------------------------------------------------------------
router.get(
  "/",
  requirePermission("expense.view"),
  validateQuery(listExpensesQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListExpensesQuery;
    const where: Prisma.ExpenseWhereInput = { deletedAt: null };

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.approvalStatus) where.approvalStatus = query.approvalStatus;
    if (query.paidInCash !== undefined) where.paidInCash = query.paidInCash;
    if (query.isRecurring !== undefined) where.isRecurring = query.isRecurring;
    if (query.q) where.note = { contains: query.q, mode: "insensitive" };

    if (query.dateFrom || query.dateTo) {
      where.date = {
        ...(query.dateFrom ? { gte: query.dateFrom } : {}),
        ...(query.dateTo ? { lte: query.dateTo } : {}),
      };
    }

    const [total, expenses] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        include: expenseInclude,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    sendOk(res, expenses.map(serializeExpense), {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /api/expenses/:id
// ---------------------------------------------------------------------------
router.get(
  "/:id",
  requirePermission("expense.view"),
  asyncHandler(async (req, res) => {
    sendOk(res, serializeExpense(await loadExpense(req.params.id)));
  })
);

// ---------------------------------------------------------------------------
// POST /api/expenses — record one. Every role may; an Employee's opens
// PENDING (see the module comment).
// ---------------------------------------------------------------------------
router.post(
  "/",
  requirePermission("expense.create"),
  validateBody(createExpenseSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateExpenseInput;
    await requireCategory(body.categoryId);

    // The whole approval rule, in one line: someone who could approve this
    // anyway has nothing to wait for, so their own expense is APPROVED as it
    // is written. Everyone else's is a request.
    const selfApproving = can(req.user!, "expense.approve");
    const approvalStatus = (
      selfApproving ? APPROVED_EXPENSE_APPROVAL_STATUS : PENDING_EXPENSE_APPROVAL_STATUS
    ) as ExpenseApprovalStatus;
    const now = new Date();

    const created = await prisma.expense.create({
      data: {
        categoryId: body.categoryId,
        amount: body.amount,
        // Defaults to now: the common case is writing a bill down as it is
        // paid. An explicit date is what backdates last week's electricity.
        date: body.date ?? now,
        note: body.note ?? null,
        paidInCash: body.paidInCash,
        isRecurring: body.isRecurring,
        approvalStatus,
        approvedById: selfApproving ? req.user!.id : null,
        approvedAt: selfApproving ? now : null,
        createdById: req.user!.id,
      },
      include: expenseInclude,
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.EXPENSE,
      entityId: created.id,
      newValue: serializeExpense(created),
    });

    sendOk(res, serializeExpense(created), null, 201);
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/expenses/:id — Admin/Manager. An Employee cannot revise what
// they submitted; that is what approval is for.
// ---------------------------------------------------------------------------
router.patch(
  "/:id",
  requirePermission("expense.manage"),
  validateBody(updateExpenseSchema),
  asyncHandler(async (req, res) => {
    const existing = await loadExpense(req.params.id);
    const body = req.body as UpdateExpenseInput;

    if (body.categoryId) await requireCategory(body.categoryId);

    const updated = await prisma.expense.update({
      where: { id: existing.id },
      data: {
        categoryId: body.categoryId,
        amount: body.amount,
        date: body.date,
        note: body.note,
        paidInCash: body.paidInCash,
        isRecurring: body.isRecurring,
      },
      include: expenseInclude,
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: AUDIT_ENTITY.EXPENSE,
      entityId: updated.id,
      oldValue: serializeExpense(existing),
      newValue: serializeExpense(updated),
    });

    sendOk(res, serializeExpense(updated));
  })
);

// ---------------------------------------------------------------------------
// POST /api/expenses/:id/approve — sign off a pending request. Only then
// does it reach the drawer and the profit figures.
// ---------------------------------------------------------------------------
router.post(
  "/:id/approve",
  requirePermission("expense.approve"),
  asyncHandler(async (req, res) => {
    const existing = await loadExpense(req.params.id);
    // Approving something already approved (or already turned down) is not a
    // no-op the way collecting an order is: it would silently overwrite who
    // decided what, which is the one thing the audit trail exists to hold.
    if (existing.approvalStatus !== PENDING_EXPENSE_APPROVAL_STATUS) {
      throw new AppError(409, ERROR_CODES.EXPENSE_NOT_PENDING);
    }

    const updated = await prisma.expense.update({
      where: { id: existing.id },
      data: {
        approvalStatus: APPROVED_EXPENSE_APPROVAL_STATUS as ExpenseApprovalStatus,
        approvedById: req.user!.id,
        approvedAt: new Date(),
      },
      include: expenseInclude,
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.APPROVE,
      entityType: AUDIT_ENTITY.EXPENSE,
      entityId: updated.id,
      oldValue: { approvalStatus: existing.approvalStatus },
      newValue: { approvalStatus: updated.approvalStatus, approvedAt: updated.approvedAt },
    });

    sendOk(res, serializeExpense(updated));
  })
);

// ---------------------------------------------------------------------------
// POST /api/expenses/:id/reject — turn one down. It stays on the record
// (rejected, with who and why) rather than vanishing.
// ---------------------------------------------------------------------------
router.post(
  "/:id/reject",
  requirePermission("expense.approve"),
  validateBody(rejectExpenseSchema),
  asyncHandler(async (req, res) => {
    const existing = await loadExpense(req.params.id);
    if (existing.approvalStatus !== PENDING_EXPENSE_APPROVAL_STATUS) {
      throw new AppError(409, ERROR_CODES.EXPENSE_NOT_PENDING);
    }
    const body = req.body as RejectExpenseInput;

    const updated = await prisma.expense.update({
      where: { id: existing.id },
      data: {
        approvalStatus: "REJECTED" as ExpenseApprovalStatus,
        approvedById: req.user!.id,
        approvedAt: new Date(),
        // The reason goes on the expense itself, appended rather than
        // replacing what the person who recorded it wrote down.
        note: body.note ? [existing.note, body.note].filter(Boolean).join(" — ") : existing.note,
      },
      include: expenseInclude,
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.REJECT,
      entityType: AUDIT_ENTITY.EXPENSE,
      entityId: updated.id,
      oldValue: { approvalStatus: existing.approvalStatus, note: existing.note },
      newValue: { approvalStatus: updated.approvalStatus, note: updated.note },
    });

    sendOk(res, serializeExpense(updated));
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/expenses/:id — soft delete. An expense is a financial record,
// so it is hidden rather than destroyed (the same reasoning as an order).
// ---------------------------------------------------------------------------
router.delete(
  "/:id",
  requirePermission("expense.manage"),
  asyncHandler(async (req, res) => {
    const existing = await loadExpense(req.params.id);

    const deleted = await prisma.expense.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.EXPENSE,
      entityId: existing.id,
      oldValue: serializeExpense(existing),
      newValue: { deletedAt: deleted.deletedAt },
    });

    sendOk(res, { id: deleted.id, deletedAt: deleted.deletedAt });
  })
);

export default router;
