import { Router } from "express";
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody, validateQuery } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import { serializeExpenseCategory } from "@/lib/expenses";
import { writeAudit } from "@/lib/audit";
import {
  createExpenseCategorySchema,
  listExpenseCategoriesQuerySchema,
  updateExpenseCategorySchema,
  type CreateExpenseCategoryInput,
  type ListExpenseCategoriesQuery,
  type UpdateExpenseCategoryInput,
} from "@/validation/expense";
import { AUDIT_ENTITY, ERROR_CODES } from "@/constants";

// The list an expense is filed under (spec.md "Cash drawer & expenses").
// Ordinary rows rather than an enum, because the list is the shop's to
// extend: it starts with utilities/salaries/supplies/maintenance/delivery
// (seeded) and grows from the admin.
//
// Two gates:
//   * expenseCategory.view   — every role. Picking "Utilities" is part of
//                              recording an expense, which everyone may do.
//   * expenseCategory.manage — Admin/Manager. Changing the list reaches every
//                              past expense filed under it.
const router = Router();
router.use(requireAuth);

// Not paginated on purpose: this is a picker, and a shop with more than a
// screenful of expense categories has a different problem. It is still a
// bounded list (CLAUDE.md rule 15) — bounded by the shop's own list, which it
// manages here.
const categoryInclude = { _count: { select: { expenses: true } } } satisfies Prisma.ExpenseCategoryInclude;

async function loadCategory(id: string) {
  const category = await prisma.expenseCategory.findUnique({ where: { id }, include: categoryInclude });
  if (!category) throw new AppError(404, ERROR_CODES.EXPENSE_CATEGORY_NOT_FOUND);
  return category;
}

// ---------------------------------------------------------------------------
// GET /api/expense-categories
// ---------------------------------------------------------------------------
router.get(
  "/",
  requirePermission("expenseCategory.view"),
  validateQuery(listExpenseCategoriesQuerySchema),
  asyncHandler(async (req, res) => {
    const { includeInactive } = req.validatedQuery as ListExpenseCategoriesQuery;

    const categories = await prisma.expenseCategory.findMany({
      // A retired category still has to render on its past expenses, but it
      // must not be offered for new ones.
      where: includeInactive ? {} : { isActive: true },
      include: categoryInclude,
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });

    sendOk(res, categories.map(serializeExpenseCategory));
  })
);

// ---------------------------------------------------------------------------
// POST /api/expense-categories
// ---------------------------------------------------------------------------
router.post(
  "/",
  requirePermission("expenseCategory.manage"),
  validateBody(createExpenseCategorySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateExpenseCategoryInput;

    // Identity is the key, never the translated name (CLAUDE.md rule 9), so
    // this is the only uniqueness that matters.
    const existing = await prisma.expenseCategory.findUnique({ where: { key: body.key } });
    if (existing) throw new AppError(409, ERROR_CODES.EXPENSE_CATEGORY_KEY_DUPLICATE);

    const created = await prisma.expenseCategory.create({
      data: {
        key: body.key,
        name: body.name as Prisma.InputJsonValue,
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true,
      },
      include: categoryInclude,
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.EXPENSE_CATEGORY,
      entityId: created.id,
      newValue: serializeExpenseCategory(created),
    });

    sendOk(res, serializeExpenseCategory(created), null, 201);
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/expense-categories/:id — display name, order, active flag. The
// key is frozen at creation (the same reasoning as a SKU, CLAUDE.md rule 1):
// renaming reaches every expense automatically because nothing copies it.
// ---------------------------------------------------------------------------
router.patch(
  "/:id",
  requirePermission("expenseCategory.manage"),
  validateBody(updateExpenseCategorySchema),
  asyncHandler(async (req, res) => {
    const existing = await loadCategory(req.params.id);
    const body = req.body as UpdateExpenseCategoryInput;

    const updated = await prisma.expenseCategory.update({
      where: { id: existing.id },
      data: {
        name: body.name === undefined ? undefined : (body.name as Prisma.InputJsonValue),
        sortOrder: body.sortOrder,
        isActive: body.isActive,
      },
      include: categoryInclude,
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: AUDIT_ENTITY.EXPENSE_CATEGORY,
      entityId: updated.id,
      oldValue: serializeExpenseCategory(existing),
      newValue: serializeExpenseCategory(updated),
    });

    sendOk(res, serializeExpenseCategory(updated));
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/expense-categories/:id — only while nothing is filed under it.
// Otherwise the past would stop making sense; retire it (isActive: false)
// instead, which takes it out of the picker and leaves the record intact.
// ---------------------------------------------------------------------------
router.delete(
  "/:id",
  requirePermission("expenseCategory.manage"),
  asyncHandler(async (req, res) => {
    const existing = await loadCategory(req.params.id);
    if (existing._count.expenses > 0) throw new AppError(409, ERROR_CODES.EXPENSE_CATEGORY_HAS_EXPENSES);

    await prisma.expenseCategory.delete({ where: { id: existing.id } });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.EXPENSE_CATEGORY,
      entityId: existing.id,
      oldValue: serializeExpenseCategory(existing),
    });

    sendOk(res, { id: existing.id });
  })
);

export default router;
