import { Router } from "express";
import { AuditAction, type Category } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@/validation/category";
import { generateUniqueSlug } from "@/lib/slug";
import { rollUpCategoryCounts } from "@/lib/categories";
import { writeAudit } from "@/lib/audit";
import { queueCategorySync } from "@/lib/search";
import { AUDIT_ENTITY, ERROR_CODES } from "@/constants";
import type { CategoryNode } from "@/types";

const router = Router();
router.use(requireAuth);

// Nests the flat list in memory: a boutique has few categories, and a tree has no pages.
function buildTree(categories: Category[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(categories.map((c) => [c.id, { ...c, children: [] }]));
  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// True if candidateParentId is categoryId or a descendant — reparenting there would make a cycle.
function wouldCreateCycle(categories: Category[], categoryId: string, candidateParentId: string): boolean {
  if (candidateParentId === categoryId) {
    return true;
  }
  const byId = new Map(categories.map((c) => [c.id, c]));
  let current = byId.get(candidateParentId);
  while (current?.parentId) {
    if (current.parentId === categoryId) {
      return true;
    }
    current = byId.get(current.parentId);
  }
  return false;
}

// GET /api/categories — nested tree, or ?flat=true; gated on the configurable category.view.
router.get(
  "/",
  requirePermission("category.view"),
  asyncHandler(async (req, res) => {
    const [rows, direct] = await Promise.all([
      prisma.category.findMany({ orderBy: { createdAt: "asc" } }),
      // What a till can sell (active, not deleted), so a tile's count matches the grid it opens.
      prisma.product.groupBy({
        by: ["categoryId"],
        where: { deletedAt: null, isActive: true, categoryId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const totals = rollUpCategoryCounts(
      rows,
      new Map(direct.flatMap((row) => (row.categoryId ? [[row.categoryId, row._count._all] as const] : []))),
    );
    const categories = rows.map((category) => ({ ...category, productCount: totals.get(category.id) ?? 0 }));
    if (req.query.flat === "true") {
      sendOk(res, categories);
      return;
    }
    sendOk(res, buildTree(categories));
  }),
);

// POST /api/categories — create (Admin/Manager only)
router.post(
  "/",
  requirePermission("category.manage"),
  validateBody(createCategorySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateCategoryInput;

    if (body.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: body.parentId } });
      if (!parent) {
        throw new AppError(400, ERROR_CODES.CATEGORY_NOT_FOUND);
      }
    }

    const slug = await generateUniqueSlug(body.name.ar, async (candidate) => {
      const existing = await prisma.category.findUnique({ where: { slug: candidate } });
      return Boolean(existing);
    });

    const created = await prisma.category.create({
      data: {
        name: body.name,
        slug,
        parentId: body.parentId ?? null,
        isFavorite: body.isFavorite ?? false,
      },
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.CATEGORY,
      entityId: created.id,
      newValue: created,
    });

    sendOk(res, created, null, 201);
  }),
);

// PATCH /api/categories/:id — rename / reparent (Admin/Manager only)
router.patch(
  "/:id",
  requirePermission("category.manage"),
  validateBody(updateCategorySchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw new AppError(404, ERROR_CODES.CATEGORY_NOT_FOUND);
    }

    const body = req.body as UpdateCategoryInput;

    let slug: string | undefined;
    if (body.name) {
      slug = await generateUniqueSlug(body.name.ar, async (candidate) => {
        if (candidate === existing.slug) {
          return false;
        }
        const found = await prisma.category.findUnique({ where: { slug: candidate } });
        return Boolean(found);
      });
    }

    if (body.parentId !== undefined && body.parentId !== null) {
      const parent = await prisma.category.findUnique({ where: { id: body.parentId } });
      if (!parent) {
        throw new AppError(400, ERROR_CODES.CATEGORY_NOT_FOUND);
      }

      const all = await prisma.category.findMany();
      if (wouldCreateCycle(all, existing.id, body.parentId)) {
        throw new AppError(400, ERROR_CODES.CATEGORY_CIRCULAR_PARENT);
      }
    }

    const updated = await prisma.category.update({
      where: { id: existing.id },
      data: {
        name: body.name,
        slug,
        parentId: body.parentId === undefined ? undefined : body.parentId,
        // Pinning to the POS browser is an ordinary category edit: same permission and audit.
        isFavorite: body.isFavorite,
      },
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: AUDIT_ENTITY.CATEGORY,
      entityId: updated.id,
      oldValue: existing,
      newValue: updated,
    });
    await queueCategorySync(updated.id);

    sendOk(res, updated);
  }),
);

// DELETE /api/categories/:id — only once it has no children or products (no soft delete here).
router.delete(
  "/:id",
  requirePermission("category.manage"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw new AppError(404, ERROR_CODES.CATEGORY_NOT_FOUND);
    }

    const [childCount, productCount] = await Promise.all([
      prisma.category.count({ where: { parentId: existing.id } }),
      prisma.product.count({ where: { categoryId: existing.id, deletedAt: null } }),
    ]);
    if (childCount > 0) {
      throw new AppError(409, ERROR_CODES.CATEGORY_HAS_CHILDREN);
    }
    if (productCount > 0) {
      throw new AppError(409, ERROR_CODES.CATEGORY_HAS_PRODUCTS);
    }

    await prisma.category.delete({ where: { id: existing.id } });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.CATEGORY,
      entityId: existing.id,
      oldValue: existing,
    });

    sendOk(res, { id: existing.id });
  }),
);

export default router;
