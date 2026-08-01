import { Router } from "express";
import { AuditAction, Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { AppError, sendOk } from "../lib/response";
import {
  createProductSchema,
  generateVariantsSchema,
  listProductsQuerySchema,
  updateProductSchema,
  updateVariantSchema,
  type CreateProductInput,
  type GenerateVariantsInput,
  type ListProductsQuery,
  type UpdateProductInput,
  type UpdateVariantInput,
} from "../validation/product";
import { generateUniqueSlug } from "../lib/slug";
import { productSku, variantSku } from "../lib/sku";
import { generateUniqueBarcode } from "../lib/barcode";
import { buildSearchText, searchProductIds, type I18n } from "../lib/search";
import { cartesianProduct, buildComboName } from "../lib/variantCombo";
import { serializeProduct, serializeProductSummary, serializeVariant } from "../lib/pricing";
import { writeAudit } from "../lib/audit";

const router = Router();
router.use(requireAuth);

const productInclude = {
  category: true,
  variantTypes: { include: { variantType: true } },
  images: { orderBy: { sortOrder: "asc" as const } },
  variants: {
    orderBy: { variantNumber: "asc" as const },
    include: { values: { include: { optionValue: true } }, images: { orderBy: { sortOrder: "asc" as const } } },
  },
} satisfies Prisma.ProductInclude;

async function fetchFullProduct(id: string) {
  return prisma.product.findUnique({ where: { id }, include: productInclude });
}

// Validates that every selected option value actually belongs to its
// claimed variant type, returning a lookup of id -> option value row.
async function validateOptionSelections(selections: { variantTypeId: string; valueIds: string[] }[]) {
  const valueMap = new Map<string, { id: string; value: I18n }>();
  for (const sel of selections) {
    const vt = await prisma.variantType.findUnique({ where: { id: sel.variantTypeId }, include: { values: true } });
    if (!vt) throw new AppError(400, "error.variantType.not_found");
    const validIds = new Set(vt.values.map((v) => v.id));
    for (const valueId of sel.valueIds) {
      if (!validIds.has(valueId)) throw new AppError(400, "error.variantType.value_not_found");
    }
    for (const v of vt.values) {
      if (sel.valueIds.includes(v.id)) valueMap.set(v.id, { id: v.id, value: v.value as I18n });
    }
  }
  return valueMap;
}

// ---------------------------------------------------------------------------
// GET /api/products — list (pagination + filtering + sorting + search)
// ---------------------------------------------------------------------------
router.get(
  "/",
  validateQuery(listProductsQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListProductsQuery;
    const where: Prisma.ProductWhereInput = { deletedAt: null };

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status) where.isActive = query.status === "active";

    if (query.priceMin !== undefined || query.priceMax !== undefined) {
      where.basePrice = {
        ...(query.priceMin !== undefined ? { gte: query.priceMin } : {}),
        ...(query.priceMax !== undefined ? { lte: query.priceMax } : {}),
      };
    }

    if (query.stock === "in_stock") {
      where.OR = [{ variants: { none: {} }, stock: { gt: 0 } }, { variants: { some: { stock: { gt: 0 } } } }];
    } else if (query.stock === "out_of_stock") {
      where.OR = [
        { variants: { none: {} }, stock: { lte: 0 } },
        { variants: { some: {}, every: { stock: { lte: 0 } } } },
      ];
    }

    if (query.q) {
      const ids = await searchProductIds(query.q);
      where.id = { in: ids.length ? ids : ["__none_matched__"] };
    }

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    sendOk(
      res,
      products.map((p) => serializeProductSummary(p, req.user!.role)),
      {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      }
    );
  })
);

// ---------------------------------------------------------------------------
// GET /api/products/:id — detail
// ---------------------------------------------------------------------------
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: productInclude,
    });
    if (!product) throw new AppError(404, "error.product.not_found");
    sendOk(res, serializeProduct(product, req.user!.role));
  })
);

// ---------------------------------------------------------------------------
// POST /api/products — create (Admin/Manager/Employee can add products)
// ---------------------------------------------------------------------------
router.post(
  "/",
  requireRole(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE),
  validateBody(createProductSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateProductInput;

    const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
    if (!category) throw new AppError(400, "error.category.not_found");

    const hasVariants = Boolean(body.optionSelections?.length);
    let valueMap: Map<string, { id: string; value: I18n }> | undefined;
    if (hasVariants) {
      valueMap = await validateOptionSelections(body.optionSelections!);
    }

    if (body.sku) {
      const dupe = await prisma.product.findUnique({ where: { sku: body.sku } });
      if (dupe) throw new AppError(409, "error.sku.duplicate");
    }

    // `cost` is Admin/Manager-only (CLAUDE.md rule 19) — silently dropped
    // for Employees rather than erroring, since they simply can't set it.
    const cost = req.user!.role === Role.EMPLOYEE ? undefined : body.cost;

    const slug = await generateUniqueSlug(body.name.ar, async (candidate) => {
      const existing = await prisma.product.findUnique({ where: { slug: candidate } });
      return Boolean(existing);
    });

    const searchText = buildSearchText(body.name, body.description);
    const barcode = await generateUniqueBarcode();

    const created = await prisma.product.create({
      data: {
        name: body.name,
        description: body.description ?? undefined,
        slug,
        searchText,
        categoryId: body.categoryId,
        basePrice: body.basePrice,
        compareAtPrice: body.compareAtPrice ?? null,
        cost: cost ?? null,
        isActive: body.isActive ?? true,
        barcode,
        stock: hasVariants ? 1 : body.stock ?? 1,
        createdById: req.user!.id,
      },
    });

    // Product.sku needs productNumber, which only exists once the row has
    // been inserted (it's a DB autoincrement) — frozen at creation, so this
    // second write happens before the client ever sees the product.
    const finalSku = hasVariants ? null : body.sku ?? productSku(created.productNumber);
    await prisma.product.update({ where: { id: created.id }, data: { sku: finalSku } });

    if (hasVariants) {
      const typeIds = [...new Set(body.optionSelections!.map((s) => s.variantTypeId))];
      await prisma.productVariantType.createMany({
        data: typeIds.map((variantTypeId) => ({ productId: created.id, variantTypeId })),
        skipDuplicates: true,
      });

      const combos = cartesianProduct(body.optionSelections!.map((s) => s.valueIds));
      let variantNumber = 0;
      for (const combo of combos) {
        variantNumber += 1;
        const values = combo.map((valueId) => valueMap!.get(valueId)!);
        await prisma.variant.create({
          data: {
            productId: created.id,
            variantNumber,
            name: buildComboName(values),
            sku: variantSku(created.productNumber, variantNumber),
            barcode: await generateUniqueBarcode(),
            stock: 1,
            values: { create: combo.map((optionValueId) => ({ optionValueId })) },
          },
        });
      }
    }

    const full = await fetchFullProduct(created.id);

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: "Product",
      entityId: created.id,
      newValue: serializeProduct(full, Role.ADMIN),
    });

    sendOk(res, serializeProduct(full, req.user!.role), null, 201);
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/products/:id — update (Admin/Manager only)
// ---------------------------------------------------------------------------
router.patch(
  "/:id",
  requireRole(Role.ADMIN, Role.MANAGER),
  validateBody(updateProductSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: productInclude,
    });
    if (!existing) throw new AppError(404, "error.product.not_found");

    const body = req.body as UpdateProductInput;

    if (body.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
      if (!category) throw new AppError(400, "error.category.not_found");
    }

    if (body.sku && body.sku !== existing.sku) {
      const dupe = await prisma.product.findUnique({ where: { sku: body.sku } });
      if (dupe) throw new AppError(409, "error.sku.duplicate");
    }

    const nameChanged = body.name !== undefined && JSON.stringify(body.name) !== JSON.stringify(existing.name);
    const descChanged =
      body.description !== undefined && JSON.stringify(body.description) !== JSON.stringify(existing.description);

    const searchText =
      nameChanged || descChanged
        ? buildSearchText((body.name ?? existing.name) as I18n, (body.description === undefined
            ? existing.description
            : body.description) as I18n | null)
        : undefined;

    let slug: string | undefined;
    if (nameChanged) {
      slug = await generateUniqueSlug(body.name!.ar, async (candidate) => {
        if (candidate === existing.slug) return false;
        const found = await prisma.product.findUnique({ where: { slug: candidate } });
        return Boolean(found);
      });
    }

    let action: AuditAction = AuditAction.UPDATE;
    if (body.isActive !== undefined && body.isActive !== existing.isActive) {
      action = body.isActive ? AuditAction.PUBLISH : AuditAction.HIDE;
    }

    const updated = await prisma.product.update({
      where: { id: existing.id },
      data: {
        name: body.name,
        description:
          body.description === undefined ? undefined : body.description === null ? Prisma.JsonNull : body.description,
        slug,
        searchText,
        categoryId: body.categoryId,
        basePrice: body.basePrice,
        compareAtPrice: body.compareAtPrice === undefined ? undefined : body.compareAtPrice,
        cost: body.cost === undefined ? undefined : body.cost,
        isActive: body.isActive,
        sku: body.sku,
        stock: existing.variants.length ? undefined : body.stock,
      },
      include: productInclude,
    });

    await writeAudit({
      userId: req.user!.id,
      action,
      entityType: "Product",
      entityId: updated.id,
      oldValue: serializeProduct(existing, Role.ADMIN),
      newValue: serializeProduct(updated, Role.ADMIN),
    });

    sendOk(res, serializeProduct(updated, req.user!.role));
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/products/:id — soft delete (Admin/Manager only)
// ---------------------------------------------------------------------------
router.delete(
  "/:id",
  requireRole(Role.ADMIN, Role.MANAGER),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) throw new AppError(404, "error.product.not_found");

    const deleted = await prisma.product.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: "Product",
      entityId: deleted.id,
      oldValue: { deletedAt: null, isActive: existing.isActive },
      newValue: { deletedAt: deleted.deletedAt, isActive: deleted.isActive },
    });

    sendOk(res, { id: deleted.id, deletedAt: deleted.deletedAt });
  })
);

// ---------------------------------------------------------------------------
// POST /api/products/:id/variants/generate — additive cartesian generation
// (Admin/Manager only; existing combinations are left untouched)
// ---------------------------------------------------------------------------
router.post(
  "/:id/variants/generate",
  requireRole(Role.ADMIN, Role.MANAGER),
  validateBody(generateVariantsSchema),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { variants: { include: { values: true } } },
    });
    if (!product) throw new AppError(404, "error.product.not_found");

    const body = req.body as GenerateVariantsInput;
    const valueMap = await validateOptionSelections(body.optionSelections);

    const typeIds = [...new Set(body.optionSelections.map((s) => s.variantTypeId))];
    await prisma.productVariantType.createMany({
      data: typeIds.map((variantTypeId) => ({ productId: product.id, variantTypeId })),
      skipDuplicates: true,
    });

    const existingCombos = new Set(
      product.variants.map((v) => v.values.map((vv) => vv.optionValueId).sort().join(","))
    );

    const combos = cartesianProduct(body.optionSelections.map((s) => s.valueIds));
    let nextNumber = product.variants.reduce((max, v) => Math.max(max, v.variantNumber), 0);
    const createdSkus: string[] = [];

    for (const combo of combos) {
      const key = [...combo].sort().join(",");
      if (existingCombos.has(key)) continue; // already generated — leave as-is

      nextNumber += 1;
      const values = combo.map((valueId) => valueMap.get(valueId)!);
      const sku = variantSku(product.productNumber, nextNumber);
      await prisma.variant.create({
        data: {
          productId: product.id,
          variantNumber: nextNumber,
          name: buildComboName(values),
          sku,
          barcode: await generateUniqueBarcode(),
          stock: 1,
          values: { create: combo.map((optionValueId) => ({ optionValueId })) },
        },
      });
      createdSkus.push(sku);
    }

    // A product transitioning from simple to variant-based no longer uses
    // its own sku (variants own it from here on).
    if (createdSkus.length && product.sku) {
      await prisma.product.update({ where: { id: product.id }, data: { sku: null } });
    }

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: "Variant",
      entityId: product.id,
      newValue: { generatedSkus: createdSkus },
    });

    const full = await fetchFullProduct(product.id);
    sendOk(res, serializeProduct(full, req.user!.role), null, 201);
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/products/:id/variants/:variantId — edit one variant
// (Admin/Manager only)
// ---------------------------------------------------------------------------
router.patch(
  "/:id/variants/:variantId",
  requireRole(Role.ADMIN, Role.MANAGER),
  validateBody(updateVariantSchema),
  asyncHandler(async (req, res) => {
    const variant = await prisma.variant.findFirst({
      where: { id: req.params.variantId, productId: req.params.id },
      include: { values: { include: { optionValue: true } } },
    });
    if (!variant) throw new AppError(404, "error.variant.not_found");

    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });
    if (!product) throw new AppError(404, "error.product.not_found");

    const body = req.body as UpdateVariantInput;

    if (body.sku && body.sku !== variant.sku) {
      const dupe = await prisma.variant.findUnique({ where: { sku: body.sku } });
      if (dupe) throw new AppError(409, "error.sku.duplicate");
    }

    const updated = await prisma.variant.update({
      where: { id: variant.id },
      data: {
        name: body.name,
        sku: body.sku,
        priceOverride: body.priceOverride === undefined ? undefined : body.priceOverride,
        cost: body.cost === undefined ? undefined : body.cost,
        stock: body.stock,
        isActive: body.isActive,
      },
      include: { values: { include: { optionValue: true } }, images: { orderBy: { sortOrder: "asc" } } },
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: "Variant",
      entityId: updated.id,
      oldValue: variant,
      newValue: updated,
    });

    sendOk(res, serializeVariant(updated, product, req.user!.role));
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/products/:id/variants/:variantId — remove one combination
// (Admin/Manager only)
// ---------------------------------------------------------------------------
router.delete(
  "/:id/variants/:variantId",
  requireRole(Role.ADMIN, Role.MANAGER),
  asyncHandler(async (req, res) => {
    const variant = await prisma.variant.findFirst({
      where: { id: req.params.variantId, productId: req.params.id },
    });
    if (!variant) throw new AppError(404, "error.variant.not_found");

    await prisma.variant.delete({ where: { id: variant.id } });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: "Variant",
      entityId: variant.id,
      oldValue: variant,
    });

    sendOk(res, { id: variant.id });
  })
);

export default router;
