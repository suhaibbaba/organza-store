import { Router } from "express";
import { AuditAction } from "@prisma/client";
import { can } from "@shared/lib/permissions";
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
import { searchProductIds } from "@/lib/search";
import {
  countValue,
  fileChangeRequests,
  findPendingChangesByEntity,
  serializeChangeRequests,
} from "@/lib/changeRequests";
import {
  AUDIT_ENTITY,
  CHANGE_REQUEST_ENTITIES,
  CHANGE_REQUEST_FIELDS,
  DEFAULT_LOW_STOCK_THRESHOLD,
  ERROR_CODES,
  SETTINGS_SINGLETON_ID,
} from "@/constants";
import type { StockItem } from "@/types";

// Inventory is a read/adjust layer over Product (simple products) and
// Variant (variant-bearing products) stock — it doesn't own its own table.
// Both viewing (inventory.view) and adjusting (inventory.adjust) are
// Admin/Manager only — CLAUDE.md rule 5: an Employee has no stock-management
// access, so the stock list 403s for them just like an adjustment does.
//
// This is the MANUAL stock path, and the only stock path that is ever gated
// (spec.md "Employee change approvals"). Stock coming off the shelf because
// something was SOLD never passes through here — see lib/orderStock.ts — so
// a sale always completes on the spot, whoever rang it up.
const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/inventory — flattened stock list (simple products + variants),
// pagination + filtering + sorting. lowStock=true filters against
// Setting.lowStockThreshold (CLAUDE.md rule 14 — never hard-code it), and
// only over products that opted into tracking (Product.trackLowStock): most
// products are one-off pieces with stock = 1, so alerting on all of them
// would bury the ones that actually need restocking.
// ---------------------------------------------------------------------------
router.get(
  "/",
  requirePermission("inventory.view"),
  validateQuery(listInventoryQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListInventoryQuery;
    const setting = await prisma.setting.findUnique({ where: { id: SETTINGS_SINGLETON_ID } });
    const threshold = setting?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

    // Name/description matching goes through the shared, normalized,
    // cross-language search layer (CLAUDE.md rule 10) — the same one
    // /api/products uses — rather than a raw `contains` against the
    // already-normalized `searchText` column, which would silently miss
    // anything with tashkeel or an unnormalized letter (ة/ه, أ/إ/آ/ا, ...).
    // SKU/barcode matching is exact-ish and checked at both the product and
    // variant level, since a staff member searches by whichever one is
    // printed on the item in their hand.
    const nameMatchIds = query.q ? await searchProductIds(query.q) : null;

    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
        // Opt-in only: a product that hasn't asked to be tracked can never
        // surface as low stock, whatever its quantity.
        ...(query.lowStock ? { trackLowStock: true } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.q
          ? {
              OR: [
                { id: { in: nameMatchIds ?? [] } },
                { sku: { contains: query.q, mode: "insensitive" } },
                { barcode: { contains: query.q, mode: "insensitive" } },
                {
                  variants: {
                    some: {
                      OR: [
                        { sku: { contains: query.q, mode: "insensitive" } },
                        { barcode: { contains: query.q, mode: "insensitive" } },
                      ],
                    },
                  },
                },
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
          trackLowStock: product.trackLowStock,
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
            // Tracking is a product-level opt-in; every variant of a tracked
            // product is tracked with it.
            trackLowStock: product.trackLowStock,
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

    // What is waiting on the rows actually shown — one query for the page,
    // never one per row, so a stock figure somebody has asked to change reads
    // as spoken for rather than as simply wrong.
    const pendingByEntity = await findPendingChangesByEntity(
      page.map((item) => ({
        entityType:
          item.type === "variant" ? CHANGE_REQUEST_ENTITIES.VARIANT : CHANGE_REQUEST_ENTITIES.PRODUCT,
        entityId: item.id,
      }))
    );
    const rows = page.map((item) => ({
      ...item,
      pendingChanges: serializeChangeRequests(pendingByEntity.get(item.id) ?? []),
    }));

    sendOk(res, rows, {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    });
  })
);

// Typing a stock figure you may not set is a request, not a refusal (spec.md
// "Employee change approvals"). Reaching these endpoints at all still needs
// inventory.view, so nobody who cannot see the stock list can move it either;
// what the gate below decides is whether the figure lands or waits.
//
// Today every role holding inventory.view also holds inventory.adjust, so the
// request branch is unreachable from the inventory screen — an Employee's
// manual stock edit arrives through the product form instead
// (PATCH /api/products/:id), which is gated the same way. The branch is here
// so that the rule lives with the action rather than with today's role table.
function mayAdjustDirectly(user: { role: string }): boolean {
  return can(user, "inventory.adjust");
}

function assertMayRequest(user: { role: string }): void {
  if (!can(user, "changeRequest.create")) throw new AppError(403, ERROR_CODES.FORBIDDEN);
}

// ---------------------------------------------------------------------------
// PATCH /api/inventory/products/:id — set a simple product's stock
// ---------------------------------------------------------------------------
router.patch(
  "/products/:id",
  requirePermission("inventory.view"),
  validateBody(adjustStockSchema),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { variants: { select: { id: true } } },
    });
    if (!product) throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);
    if (product.variants.length > 0) throw new AppError(400, ERROR_CODES.INVENTORY_PARENT_HAS_VARIANTS);

    const body = req.body as AdjustStockInput;

    if (!mayAdjustDirectly(req.user!)) {
      assertMayRequest(req.user!);
      const [filed] = await fileChangeRequests(req.user!, [
        {
          entityType: CHANGE_REQUEST_ENTITIES.PRODUCT,
          entityId: product.id,
          field: CHANGE_REQUEST_FIELDS.PRODUCT_STOCK,
          entityLabel: product.name,
          entityDetail: product.sku,
          productId: product.id,
          oldValue: countValue(product.stock),
          newValue: countValue(body.stock),
        },
      ]);
      // 202: accepted, not applied. The stock still reads as it was.
      sendOk(res, { id: product.id, stock: product.stock, pendingChange: filed }, null, 202);
      return;
    }

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
  requirePermission("inventory.view"),
  validateBody(adjustStockSchema),
  asyncHandler(async (req, res) => {
    const variant = await prisma.variant.findUnique({
      where: { id: req.params.id },
      include: { product: { select: { id: true } } },
    });
    if (!variant) throw new AppError(404, ERROR_CODES.VARIANT_NOT_FOUND);

    const body = req.body as AdjustStockInput;

    if (!mayAdjustDirectly(req.user!)) {
      assertMayRequest(req.user!);
      const [filed] = await fileChangeRequests(req.user!, [
        {
          entityType: CHANGE_REQUEST_ENTITIES.VARIANT,
          entityId: variant.id,
          field: CHANGE_REQUEST_FIELDS.VARIANT_STOCK,
          entityLabel: variant.name,
          entityDetail: variant.sku,
          productId: variant.product.id,
          oldValue: countValue(variant.stock),
          newValue: countValue(body.stock),
        },
      ]);
      sendOk(res, { id: variant.id, stock: variant.stock, pendingChange: filed }, null, 202);
      return;
    }

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
