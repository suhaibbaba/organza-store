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
import { writeAudit } from "@/lib/audit";
import { AUDIT_ENTITY, ERROR_CODES } from "@/constants";
import type { CategoryNode } from "@/types";

const router = Router();
router.use(requireAuth);

// Builds the parent/child tree from a flat list — categories are few enough
// (a boutique's catalog) that loading them all and nesting in memory is
// simpler than a recursive CTE, and keeps pagination out of a hierarchy that
// doesn't really have "pages".
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

// True if `candidateParentId` is `categoryId` itself or one of its
// descendants — reparenting onto either would create a cycle.
function wouldCreateCycle(categories: Category[], categoryId: string, candidateParentId: string): boolean {
  if (candidateParentId === categoryId) return true;
  const byId = new Map(categories.map((c) => [c.id, c]));
  let current = byId.get(candidateParentId);
  while (current?.parentId) {
    if (current.parentId === categoryId) return true;
    current = byId.get(current.parentId);
  }
  return false;
}

// ---------------------------------------------------------------------------
// GET /api/categories — list as a nested tree (default) or ?flat=true
// ---------------------------------------------------------------------------
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({ orderBy: { createdAt: "asc" } });
    if (req.query.flat === "true") {
      sendOk(res, categories);
      return;
    }
    sendOk(res, buildTree(categories));
  })
);

// ---------------------------------------------------------------------------
// POST /api/categories — create (Admin/Manager only)
// ---------------------------------------------------------------------------
router.post(
  "/",
  requirePermission("category.manage"),
  validateBody(createCategorySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateCategoryInput;

    if (body.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: body.parentId } });
      if (!parent) throw new AppError(400, ERROR_CODES.CATEGORY_NOT_FOUND);
    }

    const slug = await generateUniqueSlug(body.name.ar, async (candidate) => {
      const existing = await prisma.category.findUnique({ where: { slug: candidate } });
      return Boolean(existing);
    });

    const created = await prisma.category.create({
      data: { name: body.name, slug, parentId: body.parentId ?? null },
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.CATEGORY,
      entityId: created.id,
      newValue: created,
    });

    sendOk(res, created, null, 201);
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/categories/:id — rename / reparent (Admin/Manager only)
// ---------------------------------------------------------------------------
router.patch(
  "/:id",
  requirePermission("category.manage"),
  validateBody(updateCategorySchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, ERROR_CODES.CATEGORY_NOT_FOUND);

    const body = req.body as UpdateCategoryInput;

    let slug: string | undefined;
    if (body.name) {
      slug = await generateUniqueSlug(body.name.ar, async (candidate) => {
        if (candidate === existing.slug) return false;
        const found = await prisma.category.findUnique({ where: { slug: candidate } });
        return Boolean(found);
      });
    }

    if (body.parentId !== undefined && body.parentId !== null) {
      const parent = await prisma.category.findUnique({ where: { id: body.parentId } });
      if (!parent) throw new AppError(400, ERROR_CODES.CATEGORY_NOT_FOUND);

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

    sendOk(res, updated);
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/categories/:id — blocked while it has children or products
// (Admin/Manager only). Categories have no soft-delete column, so deletion
// is only ever allowed once the category is empty — reassign children/
// products elsewhere first, then delete.
// ---------------------------------------------------------------------------
router.delete(
  "/:id",
  requirePermission("category.manage"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, ERROR_CODES.CATEGORY_NOT_FOUND);

    const [childCount, productCount] = await Promise.all([
      prisma.category.count({ where: { parentId: existing.id } }),
      prisma.product.count({ where: { categoryId: existing.id, deletedAt: null } }),
    ]);
    if (childCount > 0) throw new AppError(409, ERROR_CODES.CATEGORY_HAS_CHILDREN);
    if (productCount > 0) throw new AppError(409, ERROR_CODES.CATEGORY_HAS_PRODUCTS);

    await prisma.category.delete({ where: { id: existing.id } });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.CATEGORY,
      entityId: existing.id,
      oldValue: existing,
    });

    sendOk(res, { id: existing.id });
  })
);

export default router;
