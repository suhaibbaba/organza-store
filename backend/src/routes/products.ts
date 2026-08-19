import { Router } from "express";
import { AuditAction, Prisma, Role } from "@prisma/client";
import { can } from "@organza/shared/lib/permissions";
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
import { buildSearchText, searchProductIds } from "@/lib/search";
import { cartesianProduct, buildComboName, buildImagePointMap, resolveComboImagePoint } from "@/lib/variantCombo";
import { generateVariantsForProduct, previewComboNames, validateOptionSelections } from "@/lib/variants";
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
} from "@/constants";
import type { AnyRecord, ChangeRequestDraft, I18n, OptionValueLookup } from "@/types";

const router = Router();
router.use(requireAuth);

const productInclude = {
  category: true,
  variantTypes: { include: { variantType: true } },
  // What each option value means on this product (spec.md "Notes on a
  // product's options"). Loaded with the product rather than per variant:
  // serializeVariant hangs each note on the value it belongs to, so every
  // screen that draws a value draws its note too.
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

// A product plus whatever is still waiting for an Admin on it, its variants
// or its photos (spec.md "Employee change approvals"). Attached to every
// product response so that an Employee who re-prices a piece sees their
// figure held against the old one rather than apparently discarded — and so
// an Admin looking at the same product sees what is outstanding on it.
async function serializeProductWithPending(product: AnyRecord, role: Role) {
  const pending = await findPendingChangesForProduct(product);
  return { ...serializeProduct(product, role), pendingChanges: serializeChangeRequests(pending) };
}

/**
 * Whether this caller may ASK for a change they cannot make (spec.md
 * "Employee change approvals"), and the refusal when they may not. Without
 * changeRequest.create a gated field is simply refused, which is what the
 * flow looked like before requests existed.
 */
function assertMayRequest(user: { role: string }): void {
  if (!can(user, "changeRequest.create")) throw new AppError(403, ERROR_CODES.FORBIDDEN);
}

// ---------------------------------------------------------------------------
// GET /api/products — list (pagination + filtering + sorting + search)
// ---------------------------------------------------------------------------
// Gated on product.view, which every role holds as shipped — so this changes
// nothing about who can read the catalogue today. It is here because
// product.view became CONFIGURABLE (spec.md "Editable role permissions"): an
// Admin who unticks it for a role has to find that the API refuses them, not
// merely that a nav item vanished while `curl` still worked.
router.get(
  "/",
  requirePermission("product.view"),
  validateQuery(listProductsQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListProductsQuery;
    const where: Prisma.ProductWhereInput = { deletedAt: null };

    if (query.categoryId) {
      // "Women" on the POS browser's sidebar has to bring back the dresses
      // filed under it, not the nothing that usually sits on the parent
      // itself (see lib/categories.ts). Opt-in, so the admin's own filter
      // keeps meaning exactly the shelf it names.
      where.categoryId = query.includeSubcategories
        ? { in: await collectCategorySubtreeIds(query.categoryId) }
        : query.categoryId;
    }
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

    // Barcode-label work queue: "not_printed" is the list of pieces still
    // waiting for a label, "printed" is what has already been through the
    // printer (for a reprint). "all" — the default — filters nothing.
    //
    // A piece using the supplier's own barcode is not waiting for anything: it
    // came with its label on. It drops out of the queue by its barcode SOURCE
    // — never by stamping labelsPrintedAt, which would claim a print run that
    // never happened. `printed` and `all` still list it, because printing our
    // own label over a supplier code has to stay possible.
    if (query.printState === "not_printed") {
      where.labelsPrintedAt = null;
      // AND, not a merge: NEEDS_LABEL_WHERE carries its own OR, and the stock
      // filter above may already own `where.OR`.
      where.AND = [NEEDS_LABEL_WHERE];
    } else if (query.printState === "printed") {
      where.labelsPrintedAt = { not: null };
    }

    // Quick sell's work queue (spec.md "Quick sell"). AND rather than a merge,
    // for the same reason printState is: this clause has to survive alongside
    // whatever the stock filter and the label queue already put on `where`.
    if (query.completeness !== DEFAULT_PRODUCT_COMPLETENESS_FILTER) {
      const clause =
        query.completeness === "needs_completing" ? NEEDS_COMPLETING_WHERE : QUICK_SOLD_WHERE;
      where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), clause];
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
//
// One code does NOT always resolve to one sellable thing. A PARENT code on a
// product that has variants stands for the whole garment, not for the size
// that just sold, so scanning it answers with the choice instead of an item —
// kind VARIANT_SELECTION, variant null — and the cashier picks which. Handing
// back the parent as an item would invite a sale that deducts stock from the
// wrong place; the orders API refuses a variant-bearing parent regardless
// (error.order.variant_required), so the two gates agree.
//
// This began as the numbered shawls' parent scan (spec.md "Numbered shawls":
// one photo, numbers drawn on it, one label for the collection) and is now the
// rule for every parent code, because a supplier who prints ONE barcode for
// all sizes leaves the shop in exactly the same position. One mechanism, not
// two: a numbered product additionally gets `numbers` — the same choice laid
// out by number, with each number's stock and its point on the photo.
// ---------------------------------------------------------------------------
router.get(
  "/lookup",
  requirePermission("product.view"),
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
    const matched = variant
      ? serialized.variants.find((v: AnyRecord) => v.id === variant.id) ?? null
      : null;

    // A variant scanned on its own label is an ordinary hit — it IS one piece.
    // A parent code is only a question when there is something to ask about:
    // a product with no variants (including a numbered one whose points have
    // not been placed yet) is itself the item, and answering a scan with an
    // empty picker would leave the cashier no way forward.
    const needsVariant = !matched && serialized.variants.length > 0;
    const numbers = needsVariant ? buildNumberOptions(product, serialized.variants) : [];

    sendOk(res, {
      kind: needsVariant ? PRODUCT_LOOKUP_KIND.VARIANT_SELECTION : PRODUCT_LOOKUP_KIND.ITEM,
      product: serialized,
      // Never a sellable item on a VARIANT_SELECTION — that is the whole point.
      variant: needsVariant ? null : matched,
      // Numbered products only; an ordinary parent's variants are picked from
      // `product.variants` (isNumberedProduct is what buildNumberOptions
      // branches on).
      numbers,
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/products/labels/printed — record that a batch of barcode labels
// went to the printer, so the "still to print" queue empties as the roll
// comes off (CLAUDE.md rule 13: the barcode is generated by us, and every
// piece needs its label before it can go on the shelf).
//
// Held by every role, Employees included: an Employee may add products, and
// a new piece is useless on the shelf without its label. Nothing but the
// timestamp is written — no price, stock or visibility — so this stays clear
// of the gates an Employee must not pass (CLAUDE.md rule 5).
//
// Reprinting is never blocked: a label falls off, a piece comes back, the
// roll jams. Calling this again simply moves the timestamp forward.
//
// Declared before "/:id" for the same reason as /lookup above.
// ---------------------------------------------------------------------------
router.post(
  "/labels/printed",
  requirePermission("product.printLabels"),
  validateBody(markLabelsPrintedSchema),
  asyncHandler(async (req, res) => {
    const { productIds } = req.body as MarkLabelsPrintedInput;
    // The same product twice in one print run is one product as far as the
    // timestamp (and the audit trail) is concerned.
    const ids = [...new Set(productIds)];

    const existing = await prisma.product.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, labelsPrintedAt: true },
    });
    // All or nothing: a half-applied print run would leave the queue lying
    // about which labels are still owed.
    if (existing.length !== ids.length) throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);

    const labelsPrintedAt = new Date();
    await prisma.product.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { labelsPrintedAt },
    });

    // One entry per product (CLAUDE.md rule 6) — "who reprinted this label,
    // and when" is a per-product question.
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
  })
);

// ---------------------------------------------------------------------------
// GET /api/products/:id — detail
// ---------------------------------------------------------------------------
router.get(
  "/:id",
  requirePermission("product.view"),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: productInclude,
    });
    if (!product) throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);
    sendOk(res, await serializeProductWithPending(product, req.user!.role));
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

    // Which kind of product this is, chosen here and never inferred later
    // (spec.md "Numbered shawls"): a numbered product's variants are its
    // numbers, an ordinary one's are its colours/sizes, and the two never mix.
    const isNumbered = body.isNumbered ?? false;

    const hasVariants = Boolean(body.optionSelections?.length);
    let valueMap: Map<string, OptionValueLookup> | undefined;
    if (hasVariants) {
      valueMap = await validateOptionSelections(body.optionSelections!, isNumbered);
    }

    if (body.sku) {
      const dupe = await prisma.product.findUnique({ where: { sku: body.sku } });
      if (dupe) throw new AppError(409, ERROR_CODES.SKU_DUPLICATE);
    }

    // A note against a value this product will not use is refused here, with
    // nothing yet created — the alternative is a 400 handed back for a
    // product that exists anyway (spec.md "Notes on a product's options").
    const selectedTypeIds = [...new Set((body.optionSelections ?? []).map((sel) => sel.variantTypeId))];
    await assertOptionValueNotesUsable(body.optionValueNotes, selectedTypeIds);

    // `cost` is ADMIN-ONLY (CLAUDE.md rule 19) — silently dropped for a
    // Manager or an Employee rather than erroring, since they simply can't
    // set what they can't see.
    const cost = can(req.user!, "product.viewCost") ? body.cost : undefined;

    // Opt-in low-stock tracking is a stock-management decision, so it follows
    // the stock gate itself — dropped (left at the schema default of false)
    // for an Employee who can add products but doesn't manage stock
    // (CLAUDE.md rule 5).
    const trackLowStock = can(req.user!, "inventory.adjust") ? body.trackLowStock : undefined;

    const slug = await generateUniqueSlug(body.name.ar, async (candidate) => {
      const existing = await prisma.product.findUnique({ where: { slug: candidate } });
      return Boolean(existing);
    });

    const searchText = buildSearchText(body.name, body.description);
    // Ours unless the body says the garment came with its own (CLAUDE.md rule
    // 13: generation is the default). A product WITH variants may carry one
    // too — a supplier's single code for every size lives on the parent, and
    // scanning it opens the variant picker.
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
        // Left null unless the form actually chose one: null is "follow the
        // photo", which is what almost every product wants (spec.md
        // "Numbered shawls").
        pointTextColor: body.pointTextColor ?? null,
        pointBackgroundColor: body.pointBackgroundColor ?? null,
        ...barcodeFields,
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

    // What each chosen value MEANS on this product — written once the variant
    // types exist, since the types the product uses are what a note may be
    // written against. Scoped to this product: the same "S" on the next one
    // keeps whatever it had.
    await applyOptionValueNotes(created.id, body.optionValueNotes, selectedTypeIds);

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
// PATCH /api/products/:id — update the details (every role that can edit),
// with the money/stock/visibility fields each behind their own gate
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

    // product.edit covers the details — name, description, category. What
    // the piece sells for, how many there are and whether customers can see
    // it each need their own permission, none of which an Employee holds
    // (CLAUDE.md rule 5). Each is compared against what is stored, so a form
    // that resends an unchanged value still saves.
    //
    // A real change to one of those fields by somebody who may not make it is
    // no longer refused: it becomes a REQUEST (spec.md "Employee change
    // approvals"). The rest of the save goes through as normal, so an
    // Employee fixing a name and a price in one go gets the name saved and
    // the price held — nothing of what they typed is thrown away.
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

    // Stock is ignored outright on a variant-bearing product (each variant
    // carries its own), so it's only a change worth gating on a simple one.
    const stockChanged =
      existing.variants.length === 0 && body.stock !== undefined && body.stock !== existing.stock;
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

    // Switching a product between "sells numbers" and "sells colours/sizes"
    // (spec.md "Numbered shawls") while it still has variants would strand
    // every one of them under a rule they don't satisfy. Nothing is deleted
    // on the user's behalf — the switch is refused, and the UI says which
    // variants have to go first.
    const kindChanged = body.isNumbered !== undefined && body.isNumbered !== existing.isNumbered;
    if (kindChanged && existing.variants.length > 0) {
      throw new AppError(409, ERROR_CODES.PRODUCT_NUMBERED_SWITCH_HAS_VARIANTS);
    }

    if (body.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
      if (!category) throw new AppError(400, ERROR_CODES.CATEGORY_NOT_FOUND);
    }

    if (body.sku && body.sku !== existing.sku) {
      const dupe = await prisma.product.findUnique({ where: { sku: body.sku } });
      if (dupe) throw new AppError(409, ERROR_CODES.SKU_DUPLICATE);
    }

    // Which code this piece carries, and whether it is ours or the
    // supplier's. Reversible in both directions at any time, and refused
    // outright when the code is already in use anywhere in the store
    // (error.barcode.duplicate, naming what it clashes with) — a duplicate
    // would silently sell the wrong item. Null when the request said nothing
    // about the barcode, or said what is already stored.
    //
    // Gated on product.edit, like the SKU beside it: both are the piece's
    // identity rather than its money, its stock or its visibility, so this is
    // not one of the five actions held for approval (CLAUDE.md rule 21). The
    // audit entry below carries the old and new code and source either way.
    const barcodeUpdate = await resolveBarcodeChange(existing, body, { productId: existing.id });

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

    // The notes and the product row move together, in one transaction: a save
    // is one thing, so either the details and the notes both landed or
    // neither did (spec.md "Notes on a product's options").
    //
    // Gated on product.edit, like the name and the description beside it: a
    // note is what a product SAYS, not what it costs, how many there are or
    // whether it is on the shelf — so it is not one of the five actions held
    // for approval (CLAUDE.md rule 21), and an Employee's note applies while
    // their price change in the same save still waits for an Admin.
    const updated = await prisma.$transaction(async (tx) => {
      await applyOptionValueNotes(
        existing.id,
        body.optionValueNotes,
        existing.variantTypes.map((pvt) => pvt.variantTypeId),
        tx
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
          // Everything gated above is written only by a caller who holds the
          // permission for it. The checks already rejected an actual change,
          // so this just keeps a resent-but-unchanged value from being written
          // back by someone who may not set it — `cost` in particular, which
          // nobody below Admin even receives (CLAUDE.md rule 19) and would
          // otherwise be blanked out by echoing the form's empty field.
          basePrice: canEditPrice ? body.basePrice : undefined,
          compareAtPrice: canEditPrice && body.compareAtPrice !== undefined ? body.compareAtPrice : undefined,
          cost: can(req.user!, "product.viewCost") && body.cost !== undefined ? body.cost : undefined,
          isActive: canHide ? body.isActive : undefined,
          trackLowStock: canAdjustStock ? body.trackLowStock : undefined,
          isNumbered: body.isNumbered,
          // How this product's numbers are drawn — presentation, like the name
          // beside it, so it rides on product.edit and is never held for
          // approval (CLAUDE.md rule 21 lists what is). Null is sent
          // deliberately to hand a colour back to the photo, so `undefined`
          // (field absent) is the only thing that leaves it alone.
          pointTextColor: body.pointTextColor,
          pointBackgroundColor: body.pointBackgroundColor,
          sku: body.sku,
          ...(barcodeUpdate?.data ?? {}),
          // A code nobody has printed yet puts the piece back in the label queue:
          // whatever sticker is on it now carries a different number. Restoring
          // the code we parked leaves the timestamp alone, because that label is
          // still correct.
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

    // Filed after the save, so a request only ever exists alongside a change
    // that actually went through.
    if (drafts.length) await fileChangeRequests(req.user!, drafts);

    sendOk(res, await serializeProductWithPending(updated, req.user!.role));
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/products/:id — soft delete (Admin/Manager only)
// ---------------------------------------------------------------------------
router.delete(
  "/:id",
  requirePermission("product.delete"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { variants: { select: { id: true } }, images: { select: { id: true } } },
    });
    if (!existing) throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);

    const deleted = await prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id: existing.id },
        data: { deletedAt: new Date(), isActive: false },
      });
      // Nothing can be waiting on a product that has just been taken off the
      // books — leaving those requests on the approval screen would only
      // offer an Admin decisions that no longer mean anything.
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

    sendOk(res, { id: deleted.id, deletedAt: deleted.deletedAt });
  })
);

// ---------------------------------------------------------------------------
// POST /api/products/:id/variants/generate — additive cartesian generation
// (existing combinations are left untouched).
//
// WHICH variants a product has is a gated change (spec.md "Employee change
// approvals"): an Employee may ask for combinations to be added, and an
// Admin decides. Admin/Manager generate them on the spot, as before.
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
    // Validated either way, before anything else: a request to add colours to
    // a numbered product is a misunderstanding of the product, and telling
    // the person now beats telling the Admin who tries to approve it later.
    const valueMap = await validateOptionSelections(body.optionSelections, product.isNumbered);

    if (!can(req.user!, "product.editVariantSet")) {
      assertMayRequest(req.user!);
      // The variant set is one field in both directions (add and remove), so
      // a second ask replaces the first rather than queueing behind it. The
      // option value IDs are what gets stored — never the names they happen
      // to have today (CLAUDE.md rule 2) — so a value renamed while the
      // request waits still resolves to the right thing on approval.
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
          }),
        },
      ]);

      const held = await fetchFullProduct(product.id);
      // 200, not 201: nothing was created. What comes back is the product as
      // it still stands, carrying the request that is waiting on it.
      sendOk(res, await serializeProductWithPending(held, req.user!.role));
      return;
    }

    const { createdSkus } = await generateVariantsForProduct(prisma, product, body.optionSelections, valueMap);

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.VARIANT,
      entityId: product.id,
      newValue: { generatedSkus: createdSkus },
    });

    const full = await fetchFullProduct(product.id);
    sendOk(res, await serializeProductWithPending(full, req.user!.role), null, 201);
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/products/:id/variants/:variantId — edit one variant (same
// per-field gates as the product update above)
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

    // Same split as the product above, on the variant's own fields: a
    // priceOverride IS what this combination sells for, so it belongs to
    // product.editPrice, not to product.edit — and a change to it by someone
    // without that permission becomes a request rather than a refusal.
    const canEditPrice = can(req.user!, "product.editPrice");
    const canAdjustStock = can(req.user!, "inventory.adjust");
    const canHide = can(req.user!, "product.hide");

    const drafts: ChangeRequestDraft[] = [];
    const variantTarget = {
      entityType: CHANGE_REQUEST_ENTITIES.VARIANT,
      entityId: variant.id,
      // The combination's own name, and above it the piece it belongs to —
      // "1" on its own is not something anybody can approve.
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
    // A variant's own isActive is not one of the five gated actions (spec.md
    // gates hiding the PRODUCT), so this stays a plain refusal.
    if (!canHide && body.isActive !== undefined && body.isActive !== variant.isActive) {
      throw new AppError(403, ERROR_CODES.FORBIDDEN);
    }

    if (body.sku && body.sku !== variant.sku) {
      const dupe = await prisma.variant.findUnique({ where: { sku: body.sku } });
      if (dupe) throw new AppError(409, ERROR_CODES.SKU_DUPLICATE);
    }

    // Each variant's barcode is its own (see the product update above for the
    // gate and the guarantees): one size can carry the supplier's printed tag
    // while the next still uses ours.
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

    // A variant on a brand-new code means the product's label sheet is out of
    // date, and the print record lives on the product (there is one timestamp
    // for the piece, not one per size).
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

    if (drafts.length) await fileChangeRequests(req.user!, drafts);

    const pending = await findPendingChangesForProduct({ id: product.id, variants: [{ id: variant.id }] });
    sendOk(res, {
      ...serializeVariant(updated, product, req.user!.role),
      pendingChanges: serializeChangeRequests(pending),
    });
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/products/:id/variants/:variantId — remove one combination.
//
// Part of the same gated field as generation above: WHICH variants a product
// has. Admin/Manager remove it there and then; an Employee's attempt becomes
// a request, and the variant stays exactly where it is until an Admin agrees.
// ---------------------------------------------------------------------------
router.delete(
  "/:id/variants/:variantId",
  requirePermission("product.edit"),
  asyncHandler(async (req, res) => {
    const variant = await prisma.variant.findFirst({
      where: { id: req.params.variantId, productId: req.params.id },
    });
    if (!variant) throw new AppError(404, ERROR_CODES.VARIANT_NOT_FOUND);

    const product = await prisma.product.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { variants: { select: { id: true, sku: true, name: true } } },
    });
    if (!product) throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);

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
      // 202: the ask was accepted, the variant is still there. The request
      // comes back so the screen can say what is now waiting on it.
      sendOk(res, { id: variant.id, deleted: false, pendingChange: filed }, null, 202);
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.variant.delete({ where: { id: variant.id } });
      // Anything anyone was waiting on for this variant is moot now — better
      // cleared than left on the approval screen pointing at nothing.
      await cancelPendingChangesFor(tx, [
        { entityType: CHANGE_REQUEST_ENTITIES.VARIANT, entityId: variant.id },
      ]);
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.VARIANT,
      entityId: variant.id,
      oldValue: variant,
    });

    sendOk(res, { id: variant.id, deleted: true });
  })
);

export default router;
