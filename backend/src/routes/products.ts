import { Router } from "express";
import { AuditAction, Prisma, Role } from "@prisma/client";
import { can } from "@shared/lib/permissions";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody, validateQuery } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import {
  createProductSchema,
  generateVariantsSchema,
  listProductsQuerySchema,
  lookupProductQuerySchema,
  updateProductSchema,
  updateVariantSchema,
  type CreateProductInput,
  type GenerateVariantsInput,
  type ListProductsQuery,
  type LookupProductQuery,
  type UpdateProductInput,
  type UpdateVariantInput,
} from "@/validation/product";
import { generateUniqueSlug } from "@/lib/slug";
import { productSku, variantSku } from "@/lib/sku";
import { generateUniqueBarcode } from "@/lib/barcode";
import { buildSearchText, searchProductIds } from "@/lib/search";
import { cartesianProduct, buildComboName, buildImagePointMap, resolveComboImagePoint } from "@/lib/variantCombo";
import { serializeProduct, serializeProductSummary, serializeVariant } from "@/lib/pricing";
import { writeAudit } from "@/lib/audit";
import { AUDIT_ENTITY, DEFAULT_STOCK, ERROR_CODES } from "@/constants";
import type { AnyRecord, I18n, OptionValueLookup } from "@/types";

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
  const valueMap = new Map<string, OptionValueLookup>();
  for (const sel of selections) {
    const vt = await prisma.variantType.findUnique({ where: { id: sel.variantTypeId }, include: { values: true } });
    if (!vt) throw new AppError(400, ERROR_CODES.VARIANT_TYPE_NOT_FOUND);
    const validIds = new Set(vt.values.map((v) => v.id));
    for (const valueId of sel.valueIds) {
      if (!validIds.has(valueId)) throw new AppError(400, ERROR_CODES.VARIANT_TYPE_VALUE_NOT_FOUND);
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
// GET /api/products/lookup?code= — resolve one scanned/typed code to the
// exact item being sold (POS). Matched against the barcode AND the SKU of
// both products and variants, because a staff member scans whichever label
// is on the piece in their hand and falls back to reading the SKU aloud
// when it's damaged.
//
// Declared before "/:id" — Express matches routes in order, so a literal
// path registered after the parameter route would never be reached.
//
// Hidden (isActive: false) products are still found here, deliberately: a
// scan is someone holding the piece at the counter, and hiding a product
// means "don't show it", not "refuse the sale" — the orders API sells it
// regardless. Only soft-deleted products are excluded. Browsing is the
// other way round: the POS search filters to active products, so an
// unpublished draft can be sold but never stumbled upon.
// ---------------------------------------------------------------------------
router.get(
  "/lookup",
  validateQuery(lookupProductQuerySchema),
  asyncHandler(async (req, res) => {
    const { code } = req.validatedQuery as LookupProductQuery;

    // Variants first: a variant-bearing product's parent carries neither the
    // stock nor the price that gets sold, so if a code matches a variant
    // that variant is the answer, whatever else it might also match.
    const variant = await prisma.variant.findFirst({
      where: { OR: [{ barcode: code }, { sku: code }], product: { deletedAt: null } },
      select: { id: true, productId: true },
    });

    const product = await prisma.product.findFirst({
      where: variant
        ? { id: variant.productId }
        : { deletedAt: null, OR: [{ barcode: code }, { sku: code }] },
      include: productInclude,
    });
    if (!product) throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);

    const serialized = serializeProduct(product, req.user!.role);
    sendOk(res, {
      product: serialized,
      variant: variant ? serialized.variants.find((v: AnyRecord) => v.id === variant.id) ?? null : null,
    });
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
    if (!product) throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);
    sendOk(res, serializeProduct(product, req.user!.role));
  })
);

// ---------------------------------------------------------------------------
// POST /api/products — create (Admin/Manager/Employee can add products)
// ---------------------------------------------------------------------------
router.post(
  "/",
  requirePermission("product.create"),
  validateBody(createProductSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateProductInput;

    const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
    if (!category) throw new AppError(400, ERROR_CODES.CATEGORY_NOT_FOUND);

    const hasVariants = Boolean(body.optionSelections?.length);
    let valueMap: Map<string, OptionValueLookup> | undefined;
    if (hasVariants) {
      valueMap = await validateOptionSelections(body.optionSelections!);
    }

    if (body.sku) {
      const dupe = await prisma.product.findUnique({ where: { sku: body.sku } });
      if (dupe) throw new AppError(409, ERROR_CODES.SKU_DUPLICATE);
    }

    // `cost` is Admin/Manager-only (CLAUDE.md rule 19) — silently dropped
    // for Employees rather than erroring, since they simply can't set it.
    const cost = can(req.user!, "product.viewCost") ? body.cost : undefined;

    // Opt-in low-stock tracking is a stock-management decision, so it follows
    // the same Admin/Manager gate as editing a product — dropped (left at the
    // schema default of false) for an Employee who can add products but
    // doesn't manage stock (CLAUDE.md rule 5).
    const trackLowStock = can(req.user!, "product.edit") ? body.trackLowStock : undefined;

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
        trackLowStock: trackLowStock ?? false,
        barcode,
        stock: hasVariants ? DEFAULT_STOCK : body.stock ?? DEFAULT_STOCK,
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
      const imagePointMap = buildImagePointMap(body.optionSelections!);
      let variantNumber = 0;
      for (const combo of combos) {
        variantNumber += 1;
        const values = combo.map((valueId) => valueMap!.get(valueId)!);
        const point = resolveComboImagePoint(combo, imagePointMap);
        await prisma.variant.create({
          data: {
            productId: created.id,
            variantNumber,
            name: buildComboName(values),
            sku: variantSku(created.productNumber, variantNumber),
            barcode: await generateUniqueBarcode(),
            stock: DEFAULT_STOCK,
            imageX: point?.imageX ?? null,
            imageY: point?.imageY ?? null,
            values: { create: combo.map((optionValueId) => ({ optionValueId })) },
          },
        });
      }
    }

    const full = await fetchFullProduct(created.id);

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.PRODUCT,
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
  requirePermission("product.edit"),
  validateBody(updateProductSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: productInclude,
    });
    if (!existing) throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);

    const body = req.body as UpdateProductInput;

    if (body.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
      if (!category) throw new AppError(400, ERROR_CODES.CATEGORY_NOT_FOUND);
    }

    if (body.sku && body.sku !== existing.sku) {
      const dupe = await prisma.product.findUnique({ where: { sku: body.sku } });
      if (dupe) throw new AppError(409, ERROR_CODES.SKU_DUPLICATE);
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
        trackLowStock: body.trackLowStock,
        sku: body.sku,
        stock: existing.variants.length ? undefined : body.stock,
      },
      include: productInclude,
    });

    await writeAudit({
      userId: req.user!.id,
      action,
      entityType: AUDIT_ENTITY.PRODUCT,
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
  requirePermission("product.delete"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);

    const deleted = await prisma.product.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.PRODUCT,
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
  requirePermission("product.edit"),
  validateBody(generateVariantsSchema),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { variants: { include: { values: true } } },
    });
    if (!product) throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);

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
    const imagePointMap = buildImagePointMap(body.optionSelections);
    let nextNumber = product.variants.reduce((max, v) => Math.max(max, v.variantNumber), 0);
    const createdSkus: string[] = [];

    for (const combo of combos) {
      const key = [...combo].sort().join(",");
      if (existingCombos.has(key)) continue; // already generated — leave as-is

      nextNumber += 1;
      const values = combo.map((valueId) => valueMap.get(valueId)!);
      const point = resolveComboImagePoint(combo, imagePointMap);
      const sku = variantSku(product.productNumber, nextNumber);
      await prisma.variant.create({
        data: {
          productId: product.id,
          variantNumber: nextNumber,
          name: buildComboName(values),
          sku,
          barcode: await generateUniqueBarcode(),
          stock: DEFAULT_STOCK,
          imageX: point?.imageX ?? null,
          imageY: point?.imageY ?? null,
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
      entityType: AUDIT_ENTITY.VARIANT,
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
  requirePermission("product.edit"),
  validateBody(updateVariantSchema),
  asyncHandler(async (req, res) => {
    const variant = await prisma.variant.findFirst({
      where: { id: req.params.variantId, productId: req.params.id },
      include: { values: { include: { optionValue: true } } },
    });
    if (!variant) throw new AppError(404, ERROR_CODES.VARIANT_NOT_FOUND);

    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });
    if (!product) throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);

    const body = req.body as UpdateVariantInput;

    if (body.sku && body.sku !== variant.sku) {
      const dupe = await prisma.variant.findUnique({ where: { sku: body.sku } });
      if (dupe) throw new AppError(409, ERROR_CODES.SKU_DUPLICATE);
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
        imageX: body.imageX === undefined ? undefined : body.imageX,
        imageY: body.imageY === undefined ? undefined : body.imageY,
      },
      include: { values: { include: { optionValue: true } }, images: { orderBy: { sortOrder: "asc" } } },
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: AUDIT_ENTITY.VARIANT,
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
  requirePermission("product.delete"),
  asyncHandler(async (req, res) => {
    const variant = await prisma.variant.findFirst({
      where: { id: req.params.variantId, productId: req.params.id },
    });
    if (!variant) throw new AppError(404, ERROR_CODES.VARIANT_NOT_FOUND);

    await prisma.variant.delete({ where: { id: variant.id } });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.VARIANT,
      entityId: variant.id,
      oldValue: variant,
    });

    sendOk(res, { id: variant.id });
  })
);

export default router;
