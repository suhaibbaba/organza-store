import { Router } from "express";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody, validateQuery } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import {
  adjustStockSchema,
  listInventoryQuerySchema,
  type AdjustStockInput,
  type ListInventoryQuery,
} from "@/validation/inventory";
import { writeAudit } from "@/lib/audit";
import { AUDIT_ENTITY, DEFAULT_LOW_STOCK_THRESHOLD, ERROR_CODES, SETTINGS_SINGLETON_ID } from "@/constants";
import type { StockItem } from "@/types";

// Inventory is a read/adjust layer over Product (simple products) and
// Variant (variant-bearing products) stock — it doesn't own its own table.
// Admin/Manager only (CLAUDE.md rule 5: Employee has no stock-management access).
const router = Router();
router.use(requireAuth, requirePermission("inventory.adjust"));

// ---------------------------------------------------------------------------
// GET /api/inventory — flattened stock list (simple products + variants),
// pagination + filtering + sorting. lowStock=true filters against
// Setting.lowStockThreshold (CLAUDE.md rule 14 — never hard-code it).
// ---------------------------------------------------------------------------
router.get(
  "/",
  validateQuery(listInventoryQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListInventoryQuery;
    const setting = await prisma.setting.findUnique({ where: { id: SETTINGS_SINGLETON_ID } });
    const threshold = setting?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.q
          ? {
              OR: [
                { sku: { contains: query.q, mode: "insensitive" } },
                { barcode: { contains: query.q, mode: "insensitive" } },
                { searchText: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { variants: true },
    });

    const items: StockItem[] = [];
    for (const product of products) {
      if (product.variants.length === 0) {
        items.push({
          type: "product",
          id: product.id,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          barcode: product.barcode,
          categoryId: product.categoryId,
          stock: product.stock,
          createdAt: product.createdAt,
        });
      } else {
        for (const variant of product.variants) {
          items.push({
            type: "variant",
            id: variant.id,
            productId: product.id,
            productName: product.name,
            variantName: variant.name,
            sku: variant.sku,
            barcode: variant.barcode,
            categoryId: product.categoryId,
            stock: variant.stock,
            createdAt: variant.createdAt,
          });
        }
      }
    }

    const filtered = query.lowStock ? items.filter((i) => i.stock <= threshold) : items;

    filtered.sort((a, b) => {
      const dir = query.sortDir === "asc" ? 1 : -1;
      if (query.sortBy === "sku") return dir * (a.sku ?? "").localeCompare(b.sku ?? "");
      if (query.sortBy === "createdAt") return dir * (a.createdAt.getTime() - b.createdAt.getTime());
      return dir * (a.stock - b.stock);
    });

    const total = filtered.length;
    const start = (query.page - 1) * query.pageSize;
    const page = filtered.slice(start, start + query.pageSize);

    sendOk(res, page, {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    });
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/inventory/products/:id — set a simple product's stock
// ---------------------------------------------------------------------------
router.patch(
  "/products/:id",
  validateBody(adjustStockSchema),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { variants: { select: { id: true } } },
    });
    if (!product) throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);
    if (product.variants.length > 0) throw new AppError(400, ERROR_CODES.INVENTORY_PARENT_HAS_VARIANTS);

    const body = req.body as AdjustStockInput;
    const updated = await prisma.product.update({ where: { id: product.id }, data: { stock: body.stock } });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.STOCK_CHANGE,
      entityType: AUDIT_ENTITY.PRODUCT,
      entityId: product.id,
      oldValue: { stock: product.stock },
      newValue: { stock: updated.stock },
    });

    sendOk(res, { id: updated.id, stock: updated.stock });
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/inventory/variants/:id — set a variant's stock
// ---------------------------------------------------------------------------
router.patch(
  "/variants/:id",
  validateBody(adjustStockSchema),
  asyncHandler(async (req, res) => {
    const variant = await prisma.variant.findUnique({ where: { id: req.params.id } });
    if (!variant) throw new AppError(404, ERROR_CODES.VARIANT_NOT_FOUND);

    const body = req.body as AdjustStockInput;
    const updated = await prisma.variant.update({ where: { id: variant.id }, data: { stock: body.stock } });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.STOCK_CHANGE,
      entityType: AUDIT_ENTITY.VARIANT,
      entityId: variant.id,
      oldValue: { stock: variant.stock },
      newValue: { stock: updated.stock },
    });

    sendOk(res, { id: updated.id, stock: updated.stock });
  })
);

export default router;
