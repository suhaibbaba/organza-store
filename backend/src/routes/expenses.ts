import { Router } from "express";
import { AuditAction, Prisma } from "@prisma/client";
import { can } from "@store/shared/lib/permissions";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody, validateQuery } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import { serializeExpense } from "@/lib/expenses";
import { formatMoney } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import {
  approvalValue,
  cancelPendingChangesFor,
  fileChangeRequest,
  serializeChangeRequest,
} from "@/lib/changeRequests";
import {
  createExpenseSchema,
  listExpensesQuerySchema,
  updateExpenseSchema,
  type CreateExpenseInput,
  type ListExpensesQuery,
  type UpdateExpenseInput,
} from "@/validation/expense";
import {
  APPROVED_EXPENSE_APPROVAL_STATUS,
  AUDIT_ENTITY,
  CHANGE_REQUEST_ENTITIES,
  CHANGE_REQUEST_FIELDS,
  ERROR_CODES,
  PENDING_EXPENSE_APPROVAL_STATUS,
} from "@/constants";
import type { ExpenseApprovalStatus } from "@/types";

// Expenses: create is every role's, view and manage are Admin/Manager; an Employee's expense opens PENDING.
const router = Router();
router.use(requireAuth);

const expenseInclude = {
  category: { select: { id: true, key: true, name: true } },
  // Only id + name of who recorded or approved it — nothing more about staff on a financial record.
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
} satisfies Prisma.ExpenseInclude;

async function loadExpense(id: string) {
  const expense = await prisma.expense.findFirst({ where: { id, deletedAt: null }, include: expenseInclude });
  if (!expense) {
    throw new AppError(404, ERROR_CODES.EXPENSE_NOT_FOUND);
  }
  return expense;
}

async function requireCategory(categoryId: string): Promise<void> {
  const category = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
  if (!category) {
    throw new AppError(400, ERROR_CODES.EXPENSE_CATEGORY_NOT_FOUND);
  }
}

// GET /api/expenses — list (pagination + filtering + sorting)
router.get(
  "/",
  requirePermission("expense.view"),
  validateQuery(listExpensesQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListExpensesQuery;
    const where: Prisma.ExpenseWhereInput = { deletedAt: null };

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.approvalStatus) {
      where.approvalStatus = query.approvalStatus;
    }
    if (query.paidInCash !== undefined) {
      where.paidInCash = query.paidInCash;
    }
    if (query.isRecurring !== undefined) {
      where.isRecurring = query.isRecurring;
    }
    if (query.q) {
      where.note = { contains: query.q, mode: "insensitive" };
    }

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
  }),
);

// GET /api/expenses/:id
router.get(
  "/:id",
  requirePermission("expense.view"),
  asyncHandler(async (req, res) => {
    sendOk(res, serializeExpense(await loadExpense(req.params.id)));
  }),
);

// POST /api/expenses — any role may record one; an Employee's opens PENDING.
router.post(
  "/",
  requirePermission("expense.create"),
  validateBody(createExpenseSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateExpenseInput;
    await requireCategory(body.categoryId);

    // Someone who could approve it anyway has their own expense APPROVED at once; everyone else's is a request.
    const selfApproving = can(req.user!, "expense.approve");
    const approvalStatus = (
      selfApproving ? APPROVED_EXPENSE_APPROVAL_STATUS : PENDING_EXPENSE_APPROVAL_STATUS
    ) as ExpenseApprovalStatus;
    const now = new Date();

    const created = await prisma.expense.create({
      data: {
        categoryId: body.categoryId,
        amount: body.amount,
        // Defaults to now; an explicit date backdates.
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

    // A PENDING expense is an ordinary change request: same approval screen, same notifications.
    const pendingChange = selfApproving
      ? null
      : await fileChangeRequest(req.user!, {
          entityType: CHANGE_REQUEST_ENTITIES.EXPENSE,
          entityId: created.id,
          field: CHANGE_REQUEST_FIELDS.EXPENSE_APPROVAL,
          entityLabel: created.category?.name ?? null,
          entityDetail: formatMoney(created.amount),
          oldValue: approvalValue(PENDING_EXPENSE_APPROVAL_STATUS),
          newValue: approvalValue(APPROVED_EXPENSE_APPROVAL_STATUS),
        });

    sendOk(
      res,
      { ...serializeExpense(created), pendingChange: pendingChange ? serializeChangeRequest(pendingChange) : null },
      null,
      201,
    );
  }),
);

// PATCH /api/expenses/:id — Admin/Manager; an Employee cannot revise what they submitted.
router.patch(
  "/:id",
  requirePermission("expense.manage"),
  validateBody(updateExpenseSchema),
  asyncHandler(async (req, res) => {
    const existing = await loadExpense(req.params.id);
    const body = req.body as UpdateExpenseInput;

    if (body.categoryId) {
      await requireCategory(body.categoryId);
    }

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
  }),
);

// DELETE /api/expenses/:id — soft delete: a financial record is hidden, never destroyed.
router.delete(
  "/:id",
  requirePermission("expense.manage"),
  asyncHandler(async (req, res) => {
    const existing = await loadExpense(req.params.id);

    const deleted = await prisma.$transaction(async (tx) => {
      const row = await tx.expense.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
      // A deleted expense's pending approval goes too.
      await cancelPendingChangesFor(tx, [{ entityType: CHANGE_REQUEST_ENTITIES.EXPENSE, entityId: existing.id }]);
      return row;
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
  }),
);

export default router;
