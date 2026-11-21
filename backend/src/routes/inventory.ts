import { Router } from "express";
import { AuditAction } from "@prisma/client";
import { can } from "@organza/shared/lib/permissions";
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
import { queueProductSync, searchProductIds } from "@/lib/search";
import { queueMarkedImages } from "@/lib/markedImage";
import { isRelevanceSort, rankOf } from "@/lib/search/relevance";
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
  RELEVANCE_DEFAULT_SORT,
} from "@/constants";
import type { StockItem } from "@/types";
import { MAIN_IMAGE_ONLY } from "@/constants/images";

// The MANUAL stock path and the only gated one; a sale deducts through lib/orderStock.ts and always completes.
const router = Router();
router.use(requireAuth);

// GET /api/inventory — lowStock only counts products that opted into tracking, against Setting.lowStockThreshold.
router.get(
  "/",
  requirePermission("inventory.view"),
  validateQuery(listInventoryQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListInventoryQuery;
    const setting = await prisma.setting.findUnique({ where: { id: SETTINGS_SINGLETON_ID } });
    const threshold = setting?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

    // Names go through the shared normalized search layer (rule 10); SKU/barcode match at product and variant level.
    const nameMatchIds = query.q ? await searchProductIds(query.q) : null;

    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
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
      include: {
        images: MAIN_IMAGE_ONLY,
        variants: { include: { images: MAIN_IMAGE_ONLY } },
      },
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
          thumbnailUrl: product.images[0]?.thumbnailUrl ?? null,
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
            // Tracking is a product-level opt-in; every variant of a tracked product is tracked with it.
            trackLowStock: product.trackLowStock,
            stock: variant.stock,
            thumbnailUrl: variant.images[0]?.thumbnailUrl ?? product.images[0]?.thumbnailUrl ?? null,
            createdAt: variant.createdAt,
          });
        }
      }
    }

    const filtered = query.lowStock ? items.filter((i) => i.stock <= threshold) : items;

    const rank = nameMatchIds && isRelevanceSort(query, RELEVANCE_DEFAULT_SORT.INVENTORY) ? rankOf(nameMatchIds) : null;
    filtered.sort((a, b) => {
      if (rank) return rank(a.productId) - rank(b.productId);
      const dir = query.sortDir === "asc" ? 1 : -1;
      if (query.sortBy === "sku") return dir * (a.sku ?? "").localeCompare(b.sku ?? "");
      if (query.sortBy === "createdAt") return dir * (a.createdAt.getTime() - b.createdAt.getTime());
      return dir * (a.stock - b.stock);
    });

    const total = filtered.length;
    const start = (query.page - 1) * query.pageSize;
    const page = filtered.slice(start, start + query.pageSize);

    // Pending stock requests for the shown rows, in one query for the page, never one per row.
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

// A stock figure you may not set files a request instead of being refused (spec.md "Employee change approvals").
function mayAdjustDirectly(user: { role: string }): boolean {
  return can(user, "inventory.adjust");
}

function assertMayRequest(user: { role: string }): void {
  if (!can(user, "changeRequest.create")) throw new AppError(403, ERROR_CODES.FORBIDDEN);
}

// PATCH /api/inventory/products/:id — set a simple product's stock
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
          productLabel: product.name,
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
    queueProductSync([updated.id]);
    queueMarkedImages([updated.id]);

    sendOk(res, { id: updated.id, stock: updated.stock });
  })
);

// PATCH /api/inventory/variants/:id — set a variant's stock
router.patch(
  "/variants/:id",
  requirePermission("inventory.view"),
  validateBody(adjustStockSchema),
  asyncHandler(async (req, res) => {
    const variant = await prisma.variant.findUnique({
      where: { id: req.params.id },
      // The product's name heads the approval card; a stock request on "1" names nothing on its own.
      include: { product: { select: { id: true, name: true } } },
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
          productLabel: variant.product.name,
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
    queueProductSync([variant.productId]);
    queueMarkedImages([variant.productId]);

    sendOk(res, { id: updated.id, stock: updated.stock });
  })
);

export default router;
