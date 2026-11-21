import { Router } from "express";
import { AuditAction, Prisma, Role } from "@prisma/client";
import { can } from "@store/shared/lib/permissions";
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
  markLabelsPrintedSchema,
  updateProductSchema,
  updateVariantSchema,
  type CreateProductInput,
  type GenerateVariantsInput,
  type ListProductsQuery,
  type LookupProductQuery,
  type MarkLabelsPrintedInput,
  type UpdateProductInput,
  type UpdateVariantInput,
} from "@/validation/product";
import { collectCategorySubtreeIds } from "@/lib/categories";
import { generateUniqueSlug } from "@/lib/slug";
import { productSku, variantSku } from "@/lib/sku";
import { generateUniqueBarcode, resolveBarcodeChange, resolveNewBarcode } from "@/lib/barcode";
import { NEEDS_LABEL_WHERE } from "@/lib/labelState";
import { NEEDS_COMPLETING_WHERE, QUICK_SOLD_WHERE } from "@/lib/quickSellState";
import { buildSearchText, indexProducts, queueProductSync, searchProductIds } from "@/lib/search";
import { queueMarkedImages, refreshMarkedImages } from "@/lib/markedImage";
import { isRelevanceSort, pageByRelevance } from "@/lib/search/relevance";
import { cartesianProduct, buildComboName, buildImagePointMap, resolveComboImagePoint } from "@/lib/variantCombo";
import {
  comboStockLookup,
  generateVariantsForProduct,
  previewComboNames,
  validateOptionSelections,
} from "@/lib/variants";
import { serializeProduct, serializeProductSummary, serializeVariant } from "@/lib/pricing";
import { applyOptionValueNotes, assertOptionValueNotesUsable } from "@/lib/optionValueNotes";
import { moneyChanged } from "@/lib/money";
import { buildNumberOptions, isNumberedProduct } from "@/lib/numberedProduct";
import { writeAudit } from "@/lib/audit";
import {
  cancelPendingChangesFor,
  countValue,
  fileChangeRequests,
  findPendingChangesForProduct,
  flagValue,
  moneyValue,
  serializeChangeRequests,
  variantSetValue,
} from "@/lib/changeRequests";
import {
  AUDIT_ENTITY,
  CHANGE_REQUEST_ENTITIES,
  DEFAULT_PRODUCT_COMPLETENESS_FILTER,
  CHANGE_REQUEST_FIELDS,
  CHANGE_REQUEST_VARIANT_SET_ACTIONS,
  DEFAULT_STOCK,
  ERROR_CODES,
  PRODUCT_LOOKUP_KIND,
  RELEVANCE_DEFAULT_SORT,
} from "@/constants";
import type { AnyRecord, ChangeRequestDraft, I18n, OptionValueLookup } from "@/types";

const router = Router();
router.use(requireAuth);

const productInclude = {
  category: true,
  variantTypes: { include: { variantType: true } },
  // Option-value notes loaded with the product; serializeVariant hangs each on its value.
  optionValueNotes: true,
  images: { orderBy: { sortOrder: "asc" as const } },
  variants: {
    orderBy: { variantNumber: "asc" as const },
    include: { values: { include: { optionValue: true } }, images: { orderBy: { sortOrder: "asc" as const } } },
  },
} satisfies Prisma.ProductInclude;

async function fetchFullProduct(id: string) {
  return prisma.product.findUnique({ where: { id }, include: productInclude });
}

// A product plus everything pending on it, so held edits show beside the stored values.
async function serializeProductWithPending(product: AnyRecord, role: Role) {
  const pending = await findPendingChangesForProduct(product);
  return { ...serializeProduct(product, role), pendingChanges: serializeChangeRequests(pending) };
}

/** Whether this caller may ASK for a change they cannot make; without changeRequest.create the field is simply refused. */
function assertMayRequest(user: { role: string }): void {
  if (!can(user, "changeRequest.create")) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN);
  }
}

// GET /api/products — list with pagination, filters, sort and search; gated on the configurable product.view.
router.get(
  "/",
  requirePermission("product.view"),
  validateQuery(listProductsQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListProductsQuery;
    const where: Prisma.ProductWhereInput = { deletedAt: null };

    if (query.categoryId) {
      // Opt-in descendants, so "Women" on the POS brings back what is filed under it.
      where.categoryId = query.includeSubcategories
        ? { in: await collectCategorySubtreeIds(query.categoryId) }
        : query.categoryId;
    }
    if (query.status) {
      where.isActive = query.status === "active";
    }

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

    // Label queue: not_printed / printed / all; supplier-coded pieces leave it by barcode source, never by labelsPrintedAt.
    if (query.printState === "not_printed") {
      where.labelsPrintedAt = null;
      // AND, not a merge: NEEDS_LABEL_WHERE carries its own OR, and the stock filter above may already own `where.OR`.
      where.AND = [NEEDS_LABEL_WHERE];
    } else if (query.printState === "printed") {
      where.labelsPrintedAt = { not: null };
    }

    // Quick sell's queue, ANDed so it survives the stock and label filters on `where`.
    if (query.completeness !== DEFAULT_PRODUCT_COMPLETENESS_FILTER) {
      const clause = query.completeness === "needs_completing" ? NEEDS_COMPLETING_WHERE : QUICK_SOLD_WHERE;
      where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), clause];
    }

    const ranked = query.q ? await searchProductIds(query.q) : null;
    if (ranked) {
      where.id = { in: ranked.length ? ranked : ["__none_matched__"] };
    }

    // A search on the default sort comes back closest match first; every other filter still applies in the database.
    const { total, products } =
      ranked && isRelevanceSort(query, RELEVANCE_DEFAULT_SORT.PRODUCTS)
        ? await pageByRelevance(ranked, where, query.page, query.pageSize, (ids) =>
            prisma.product.findMany({ where: { id: { in: ids } }, include: productInclude }),
          )
        : await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({
              where,
              include: productInclude,
              orderBy: { [query.sortBy]: query.sortDir },
              skip: (query.page - 1) * query.pageSize,
              take: query.pageSize,
            }),
          ]).then(([count, rows]) => ({ total: count, products: rows }));

    sendOk(
      res,
      products.map((p) => serializeProductSummary(p, req.user!.role)),
      {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    );
  }),
);

// GET /api/products/lookup?code= — one scanned or typed code (barcode or SKU) to the item being sold; before /:id.
router.get(
  "/lookup",
  requirePermission("product.view"),
  validateQuery(lookupProductQuerySchema),
  asyncHandler(async (req, res) => {
    const { code } = req.validatedQuery as LookupProductQuery;

    // Variants first: a variant-bearing parent owns neither the stock nor the price sold.
    const variant = await prisma.variant.findFirst({
      where: { OR: [{ barcode: code }, { sku: code }], product: { deletedAt: null } },
      select: { id: true, productId: true },
    });

    const product = await prisma.product.findFirst({
      where: variant ? { id: variant.productId } : { deletedAt: null, OR: [{ barcode: code }, { sku: code }] },
      include: productInclude,
    });
    if (!product) {
      throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);
    }

    const serialized = serializeProduct(product, req.user!.role);
    const matched = variant ? (serialized.variants.find((v: AnyRecord) => v.id === variant.id) ?? null) : null;

    // A parent code opens a picker only when there is something to pick; a product with no variants is the item.
    const needsVariant = !matched && serialized.variants.length > 0;
    const numbers = needsVariant ? buildNumberOptions(product, serialized.variants) : [];

    sendOk(res, {
      kind: needsVariant ? PRODUCT_LOOKUP_KIND.VARIANT_SELECTION : PRODUCT_LOOKUP_KIND.ITEM,
      product: serialized,
      // Never a sellable item on a VARIANT_SELECTION — that is the whole point.
      variant: needsVariant ? null : matched,
      // Numbered products only; an ordinary parent's variants come from product.variants.
      numbers,
    });
  }),
);

// POST /api/products/labels/printed — records a printed batch so the queue empties; every role may (rule 13).
router.post(
  "/labels/printed",
  requirePermission("product.printLabels"),
  validateBody(markLabelsPrintedSchema),
  asyncHandler(async (req, res) => {
    const { productIds } = req.body as MarkLabelsPrintedInput;
    // The same product twice in one run counts once.
    const ids = [...new Set(productIds)];

    const existing = await prisma.product.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, labelsPrintedAt: true },
    });
    // All or nothing: a half-applied print run would leave the queue lying about which labels are still owed.
    if (existing.length !== ids.length) {
      throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);
    }

    const labelsPrintedAt = new Date();
    await prisma.product.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { labelsPrintedAt },
    });

    // One entry per product (rule 6).
    for (const product of existing) {
      await writeAudit({
        userId: req.user!.id,
        action: AuditAction.UPDATE,
        entityType: AUDIT_ENTITY.PRODUCT,
        entityId: product.id,
        oldValue: { labelsPrintedAt: product.labelsPrintedAt },
        newValue: { labelsPrintedAt },
      });
    }

    sendOk(res, { productIds: ids, labelsPrintedAt });
  }),
);

// GET /api/products/:id — detail
router.get(
  "/:id",
  requirePermission("product.view"),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: productInclude,
    });
    if (!product) {
      throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);
    }
    sendOk(res, await serializeProductWithPending(product, req.user!.role));
  }),
);

// POST /api/products — create (Admin/Manager/Employee can add products)
router.post(
  "/",
  requirePermission("product.create"),
  validateBody(createProductSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateProductInput;

    const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
    if (!category) {
      throw new AppError(400, ERROR_CODES.CATEGORY_NOT_FOUND);
    }

    // Numbered or ordinary is chosen here, never inferred later; the two never mix.
    const isNumbered = body.isNumbered ?? false;

    const hasVariants = Boolean(body.optionSelections?.length);
    let valueMap: Map<string, OptionValueLookup> | undefined;
    if (hasVariants) {
      valueMap = await validateOptionSelections(body.optionSelections!, isNumbered);
    }

    if (body.sku) {
      const dupe = await prisma.product.findUnique({ where: { sku: body.sku } });
      if (dupe) {
        throw new AppError(409, ERROR_CODES.SKU_DUPLICATE);
      }
    }

    // A note against a value this product won't use is refused before anything is created.
    const selectedTypeIds = [...new Set((body.optionSelections ?? []).map((sel) => sel.variantTypeId))];
    await assertOptionValueNotesUsable(body.optionValueNotes, selectedTypeIds);

    // `cost` is Admin only (rule 19): silently dropped for anyone else.
    const cost = can(req.user!, "product.viewCost") ? body.cost : undefined;

    // Low-stock tracking follows the stock gate: dropped for an Employee (rule 5).
    const trackLowStock = can(req.user!, "inventory.adjust") ? body.trackLowStock : undefined;

    const slug = await generateUniqueSlug(body.name.ar, async (candidate) => {
      const existing = await prisma.product.findUnique({ where: { slug: candidate } });
      return Boolean(existing);
    });

    const searchText = buildSearchText(body.name, body.description);
    // Ours unless the body says the garment brought its own (rule 13); a parent may carry one code for every size.
    const barcodeFields = await resolveNewBarcode(body);

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
        isNumbered,
        // Null unless chosen: null means follow the photo.
        pointTextColor: body.pointTextColor ?? null,
        pointBackgroundColor: body.pointBackgroundColor ?? null,
        ...barcodeFields,
        stock: hasVariants ? DEFAULT_STOCK : (body.stock ?? DEFAULT_STOCK),
        createdById: req.user!.id,
      },
    });

    // sku needs the autoincrement productNumber, so this second write runs before the client sees the product.
    const finalSku = hasVariants ? null : (body.sku ?? productSku(created.productNumber));
    await prisma.product.update({ where: { id: created.id }, data: { sku: finalSku } });

    if (hasVariants) {
      const typeIds = [...new Set(body.optionSelections!.map((s) => s.variantTypeId))];
      await prisma.productVariantType.createMany({
        data: typeIds.map((variantTypeId) => ({ productId: created.id, variantTypeId })),
        skipDuplicates: true,
      });

      const combos = cartesianProduct(body.optionSelections!.map((s) => s.valueIds));
      const imagePointMap = buildImagePointMap(body.optionSelections!);
      const stockFor = comboStockLookup(body.comboStocks);
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
            stock: stockFor(combo),
            imageX: point?.imageX ?? null,
            imageY: point?.imageY ?? null,
            values: { create: combo.map((optionValueId) => ({ optionValueId })) },
          },
        });
      }
    }

    // Value notes are written once the variant types exist, scoped to this product.
    await applyOptionValueNotes(created.id, body.optionValueNotes, selectedTypeIds);

    const full = await fetchFullProduct(created.id);

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.PRODUCT,
      entityId: created.id,
      newValue: serializeProduct(full, Role.ADMIN),
    });
    await indexProducts([created.id]);
    await refreshMarkedImages([created.id]);

    sendOk(res, serializeProduct(full, req.user!.role), null, 201);
  }),
);

// PATCH /api/products/:id — details for every editing role; money, stock and visibility each behind their own gate.
router.patch(
  "/:id",
  requirePermission("product.edit"),
  validateBody(updateProductSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: productInclude,
    });
    if (!existing) {
      throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);
    }

    const body = req.body as UpdateProductInput;

    // Price, stock and visibility need their own permissions; a real change without one becomes a change request (rule 21).
    const canEditPrice = can(req.user!, "product.editPrice");
    const canAdjustStock = can(req.user!, "inventory.adjust");
    const canHide = can(req.user!, "product.hide");

    const drafts: ChangeRequestDraft[] = [];
    const productTarget = {
      entityType: CHANGE_REQUEST_ENTITIES.PRODUCT,
      entityId: existing.id,
      entityLabel: existing.name,
      productLabel: existing.name,
      entityDetail: existing.sku,
      productId: existing.id,
    } as const;

    if (!canEditPrice) {
      if (moneyChanged(body.basePrice, existing.basePrice)) {
        assertMayRequest(req.user!);
        drafts.push({
          ...productTarget,
          field: CHANGE_REQUEST_FIELDS.PRODUCT_BASE_PRICE,
          oldValue: moneyValue(existing.basePrice),
          newValue: moneyValue(body.basePrice),
        });
      }
      if (moneyChanged(body.compareAtPrice, existing.compareAtPrice)) {
        assertMayRequest(req.user!);
        drafts.push({
          ...productTarget,
          field: CHANGE_REQUEST_FIELDS.PRODUCT_COMPARE_AT_PRICE,
          oldValue: moneyValue(existing.compareAtPrice),
          newValue: moneyValue(body.compareAtPrice ?? null),
        });
      }
    }

    // Stock is ignored on a variant-bearing product, so it is only gated on a simple one.
    const stockChanged = existing.variants.length === 0 && body.stock !== undefined && body.stock !== existing.stock;
    if (!canAdjustStock && stockChanged) {
      assertMayRequest(req.user!);
      drafts.push({
        ...productTarget,
        field: CHANGE_REQUEST_FIELDS.PRODUCT_STOCK,
        oldValue: countValue(existing.stock),
        newValue: countValue(body.stock!),
      });
    }

    const visibilityChanged = body.isActive !== undefined && body.isActive !== existing.isActive;
    if (!canHide && visibilityChanged) {
      assertMayRequest(req.user!);
      drafts.push({
        ...productTarget,
        field: CHANGE_REQUEST_FIELDS.PRODUCT_IS_ACTIVE,
        oldValue: flagValue(existing.isActive),
        newValue: flagValue(body.isActive!),
      });
    }

    // Switching numbered/ordinary with variants present is refused; nothing is deleted for the user.
    const kindChanged = body.isNumbered !== undefined && body.isNumbered !== existing.isNumbered;
    if (kindChanged && existing.variants.length > 0) {
      throw new AppError(409, ERROR_CODES.PRODUCT_NUMBERED_SWITCH_HAS_VARIANTS);
    }

    if (body.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
      if (!category) {
        throw new AppError(400, ERROR_CODES.CATEGORY_NOT_FOUND);
      }
    }

    if (body.sku && body.sku !== existing.sku) {
      const dupe = await prisma.product.findUnique({ where: { sku: body.sku } });
      if (dupe) {
        throw new AppError(409, ERROR_CODES.SKU_DUPLICATE);
      }
    }

    // Which code the piece carries and whose; reversible, refused when used anywhere else (error.barcode.duplicate).
    const barcodeUpdate = await resolveBarcodeChange(existing, body, { productId: existing.id });

    const nameChanged = body.name !== undefined && JSON.stringify(body.name) !== JSON.stringify(existing.name);
    const descChanged =
      body.description !== undefined && JSON.stringify(body.description) !== JSON.stringify(existing.description);

    const searchText =
      nameChanged || descChanged
        ? buildSearchText(
            (body.name ?? existing.name) as I18n,
            (body.description === undefined ? existing.description : body.description) as I18n | null,
          )
        : undefined;

    let slug: string | undefined;
    if (nameChanged) {
      slug = await generateUniqueSlug(body.name!.ar, async (candidate) => {
        if (candidate === existing.slug) {
          return false;
        }
        const found = await prisma.product.findUnique({ where: { slug: candidate } });
        return Boolean(found);
      });
    }

    let action: AuditAction = AuditAction.UPDATE;
    if (body.isActive !== undefined && body.isActive !== existing.isActive) {
      action = body.isActive ? AuditAction.PUBLISH : AuditAction.HIDE;
    }

    // Notes and product save in one transaction; notes ride on product.edit and are never held for approval.
    const updated = await prisma.$transaction(async (tx) => {
      await applyOptionValueNotes(
        existing.id,
        body.optionValueNotes,
        existing.variantTypes.map((pvt) => pvt.variantTypeId),
        tx,
      );

      return tx.product.update({
        where: { id: existing.id },
        data: {
          name: body.name,
          description:
            body.description === undefined ? undefined : body.description === null ? Prisma.JsonNull : body.description,
          slug,
          searchText,
          categoryId: body.categoryId,
          // Gated fields are written only by holders of their permission, so an echoed empty cost never blanks the stored one.
          basePrice: canEditPrice ? body.basePrice : undefined,
          compareAtPrice: canEditPrice && body.compareAtPrice !== undefined ? body.compareAtPrice : undefined,
          cost: can(req.user!, "product.viewCost") && body.cost !== undefined ? body.cost : undefined,
          isActive: canHide ? body.isActive : undefined,
          trackLowStock: canAdjustStock ? body.trackLowStock : undefined,
          isNumbered: body.isNumbered,
          // Marker colours are presentation on product.edit; null hands colour back to the photo, undefined leaves it.
          pointTextColor: body.pointTextColor,
          pointBackgroundColor: body.pointBackgroundColor,
          sku: body.sku,
          ...(barcodeUpdate?.data ?? {}),
          // A never-printed code puts the piece back in the label queue; restoring a parked code keeps the timestamp.
          labelsPrintedAt: barcodeUpdate?.mintedFresh ? null : undefined,
          stock: existing.variants.length || !canAdjustStock ? undefined : body.stock,
        },
        include: productInclude,
      });
    });

    await writeAudit({
      userId: req.user!.id,
      action,
      entityType: AUDIT_ENTITY.PRODUCT,
      entityId: updated.id,
      oldValue: serializeProduct(existing, Role.ADMIN),
      newValue: serializeProduct(updated, Role.ADMIN),
    });
    await indexProducts([updated.id]);
    await refreshMarkedImages([updated.id]);

    // Filed after the save, so a request only exists alongside a change that went through.
    if (drafts.length) {
      await fileChangeRequests(req.user!, drafts);
    }

    sendOk(res, await serializeProductWithPending(updated, req.user!.role));
  }),
);

// DELETE /api/products/:id — soft delete (Admin/Manager only)
router.delete(
  "/:id",
  requirePermission("product.delete"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { variants: { select: { id: true } }, images: { select: { id: true } } },
    });
    if (!existing) {
      throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);
    }

    const deleted = await prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id: existing.id },
        data: { deletedAt: new Date(), isActive: false },
      });
      // Pending requests on a deleted product are cleared.
      await cancelPendingChangesFor(tx, [
        { entityType: CHANGE_REQUEST_ENTITIES.PRODUCT, entityId: existing.id },
        ...existing.variants.map((v) => ({ entityType: CHANGE_REQUEST_ENTITIES.VARIANT, entityId: v.id })),
        ...existing.images.map((i) => ({ entityType: CHANGE_REQUEST_ENTITIES.PRODUCT_IMAGE, entityId: i.id })),
      ]);
      return product;
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.PRODUCT,
      entityId: deleted.id,
      oldValue: { deletedAt: null, isActive: existing.isActive },
      newValue: { deletedAt: deleted.deletedAt, isActive: deleted.isActive },
    });
    await indexProducts([deleted.id]);
    await refreshMarkedImages([deleted.id]);

    sendOk(res, { id: deleted.id, deletedAt: deleted.deletedAt });
  }),
);

// POST /api/products/:id/variants/generate — additive; an Employee's becomes a request.
router.post(
  "/:id/variants/generate",
  requirePermission("product.edit"),
  validateBody(generateVariantsSchema),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { variants: { include: { values: true } } },
    });
    if (!product) {
      throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);
    }

    const body = req.body as GenerateVariantsInput;
    // Validated either way, so a wrong request is caught now rather than at approval.
    const valueMap = await validateOptionSelections(body.optionSelections, product.isNumbered);

    if (!can(req.user!, "product.editVariantSet")) {
      assertMayRequest(req.user!);
      // The variant set is one field, so a newer ask replaces the older; ids are stored, never names (rule 2).
      const requestedNames = previewComboNames(body.optionSelections, valueMap);
      await fileChangeRequests(req.user!, [
        {
          entityType: CHANGE_REQUEST_ENTITIES.PRODUCT,
          entityId: product.id,
          field: CHANGE_REQUEST_FIELDS.PRODUCT_VARIANT_SET,
          entityLabel: product.name,
          productLabel: product.name,
          entityDetail: product.sku,
          productId: product.id,
          oldValue: variantSetValue(product.variants.length, {
            variants: product.variants.map((v) => ({ id: v.id, sku: v.sku, name: v.name as I18n })),
          }),
          newValue: variantSetValue(requestedNames.length, {
            action: CHANGE_REQUEST_VARIANT_SET_ACTIONS.ADD,
            variants: requestedNames.map((name) => ({ name })),
            optionSelections: body.optionSelections.map((s) => ({
              variantTypeId: s.variantTypeId,
              valueIds: s.valueIds,
            })),
            ...(body.comboStocks?.length && { comboStocks: body.comboStocks }),
          }),
        },
      ]);

      const held = await fetchFullProduct(product.id);
      // 200, not 201: nothing was created; the product comes back carrying its pending request.
      sendOk(res, await serializeProductWithPending(held, req.user!.role));
      return;
    }

    const { createdSkus } = await generateVariantsForProduct(
      prisma,
      product,
      body.optionSelections,
      valueMap,
      body.comboStocks,
    );

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.VARIANT,
      entityId: product.id,
      newValue: { generatedSkus: createdSkus },
    });
    await indexProducts([product.id]);
    await refreshMarkedImages([product.id]);

    const full = await fetchFullProduct(product.id);
    sendOk(res, await serializeProductWithPending(full, req.user!.role), null, 201);
  }),
);

// PATCH /api/products/:id/variants/:variantId — edit one variant, with the product update's per-field gates.
router.patch(
  "/:id/variants/:variantId",
  requirePermission("product.edit"),
  validateBody(updateVariantSchema),
  asyncHandler(async (req, res) => {
    const variant = await prisma.variant.findFirst({
      where: { id: req.params.variantId, productId: req.params.id },
      include: { values: { include: { optionValue: true } } },
    });
    if (!variant) {
      throw new AppError(404, ERROR_CODES.VARIANT_NOT_FOUND);
    }

    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });
    if (!product) {
      throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);
    }

    const body = req.body as UpdateVariantInput;

    // A variant's priceOverride is what it sells for, so it is gated like the product price.
    const canEditPrice = can(req.user!, "product.editPrice");
    const canAdjustStock = can(req.user!, "inventory.adjust");
    const canHide = can(req.user!, "product.hide");

    const drafts: ChangeRequestDraft[] = [];
    const variantTarget = {
      entityType: CHANGE_REQUEST_ENTITIES.VARIANT,
      entityId: variant.id,
      // The combination's name under its product's, so an approver knows what "1" is.
      entityLabel: variant.name,
      productLabel: product.name,
      entityDetail: variant.sku,
      productId: product.id,
    } as const;

    if (!canEditPrice && moneyChanged(body.priceOverride, variant.priceOverride)) {
      assertMayRequest(req.user!);
      drafts.push({
        ...variantTarget,
        field: CHANGE_REQUEST_FIELDS.VARIANT_PRICE_OVERRIDE,
        oldValue: moneyValue(variant.priceOverride),
        newValue: moneyValue(body.priceOverride ?? null),
      });
    }
    if (!canAdjustStock && body.stock !== undefined && body.stock !== variant.stock) {
      assertMayRequest(req.user!);
      drafts.push({
        ...variantTarget,
        field: CHANGE_REQUEST_FIELDS.VARIANT_STOCK,
        oldValue: countValue(variant.stock),
        newValue: countValue(body.stock),
      });
    }
    // A variant's own isActive isn't gated (only hiding the product is), so this stays a plain refusal.
    if (!canHide && body.isActive !== undefined && body.isActive !== variant.isActive) {
      throw new AppError(403, ERROR_CODES.FORBIDDEN);
    }

    if (body.sku && body.sku !== variant.sku) {
      const dupe = await prisma.variant.findUnique({ where: { sku: body.sku } });
      if (dupe) {
        throw new AppError(409, ERROR_CODES.SKU_DUPLICATE);
      }
    }

    // Each variant's barcode is its own: one size can carry a supplier tag while the next uses ours.
    const barcodeUpdate = await resolveBarcodeChange(variant, body, { variantId: variant.id });

    const updated = await prisma.variant.update({
      where: { id: variant.id },
      data: {
        name: body.name,
        sku: body.sku,
        priceOverride: canEditPrice && body.priceOverride !== undefined ? body.priceOverride : undefined,
        cost: can(req.user!, "product.viewCost") && body.cost !== undefined ? body.cost : undefined,
        stock: canAdjustStock ? body.stock : undefined,
        isActive: canHide ? body.isActive : undefined,
        imageX: body.imageX === undefined ? undefined : body.imageX,
        imageY: body.imageY === undefined ? undefined : body.imageY,
        ...(barcodeUpdate?.data ?? {}),
      },
      include: { values: { include: { optionValue: true } }, images: { orderBy: { sortOrder: "asc" } } },
    });

    // A variant on a new code makes the product's label sheet stale; the print record lives on the product.
    if (barcodeUpdate?.mintedFresh) {
      await prisma.product.update({ where: { id: product.id }, data: { labelsPrintedAt: null } });
    }

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: AUDIT_ENTITY.VARIANT,
      entityId: updated.id,
      oldValue: variant,
      newValue: updated,
    });

    if (drafts.length) {
      await fileChangeRequests(req.user!, drafts);
    }
    queueProductSync([product.id]);
    queueMarkedImages([product.id]);

    const pending = await findPendingChangesForProduct({ id: product.id, variants: [{ id: variant.id }] });
    sendOk(res, {
      ...serializeVariant(updated, product, req.user!.role),
      pendingChanges: serializeChangeRequests(pending),
    });
  }),
);

// DELETE /api/products/:id/variants/:variantId — immediate for Admin/Manager; an Employee's becomes a request.
router.delete(
  "/:id/variants/:variantId",
  requirePermission("product.edit"),
  asyncHandler(async (req, res) => {
    const variant = await prisma.variant.findFirst({
      where: { id: req.params.variantId, productId: req.params.id },
    });
    if (!variant) {
      throw new AppError(404, ERROR_CODES.VARIANT_NOT_FOUND);
    }

    const product = await prisma.product.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { variants: { select: { id: true, sku: true, name: true } } },
    });
    if (!product) {
      throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);
    }

    if (!can(req.user!, "product.editVariantSet")) {
      assertMayRequest(req.user!);
      const [filed] = await fileChangeRequests(req.user!, [
        {
          entityType: CHANGE_REQUEST_ENTITIES.PRODUCT,
          entityId: product.id,
          field: CHANGE_REQUEST_FIELDS.PRODUCT_VARIANT_SET,
          entityLabel: product.name,
          productLabel: product.name,
          entityDetail: variant.sku,
          productId: product.id,
          oldValue: variantSetValue(product.variants.length, {
            variants: product.variants.map((v) => ({ id: v.id, sku: v.sku, name: v.name as I18n })),
          }),
          newValue: variantSetValue(product.variants.length - 1, {
            action: CHANGE_REQUEST_VARIANT_SET_ACTIONS.REMOVE,
            variantId: variant.id,
            variants: [{ id: variant.id, sku: variant.sku, name: variant.name as I18n }],
          }),
        },
      ]);
      // 202: the ask was accepted and the variant is still there.
      sendOk(res, { id: variant.id, deleted: false, pendingChange: filed }, null, 202);
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.variant.delete({ where: { id: variant.id } });
      // Pending requests for a removed variant are cleared.
      await cancelPendingChangesFor(tx, [{ entityType: CHANGE_REQUEST_ENTITIES.VARIANT, entityId: variant.id }]);
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.VARIANT,
      entityId: variant.id,
      oldValue: variant,
    });
    queueProductSync([variant.productId]);
    queueMarkedImages([variant.productId]);

    sendOk(res, { id: variant.id, deleted: true });
  }),
);

export default router;
