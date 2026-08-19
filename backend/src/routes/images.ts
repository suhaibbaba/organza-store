import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer, { MulterError } from "multer";
import { AuditAction, type ProductImage } from "@prisma/client";
import { can } from "@organza/shared/lib/permissions";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import { ALLOWED_IMAGE_TYPES, UPLOAD_MAX_SIZE_MB, deleteProductImageFiles, storeProductImage } from "@/lib/image";
import {
  reorderImagesSchema,
  setPrimaryImageSchema,
  uploadImageSchema,
  type ReorderImagesInput,
  type SetPrimaryImageInput,
  type UploadImageInput,
} from "@/validation/image";
import { writeAudit } from "@/lib/audit";
import { cancelPendingChangesFor, deletionValue, fileChangeRequests } from "@/lib/changeRequests";
import { AUDIT_ENTITY, CHANGE_REQUEST_ENTITIES, CHANGE_REQUEST_FIELDS, ERROR_CODES } from "@/constants";

const router = Router();
router.use(requireAuth);

function serializeImage(image: ProductImage) {
  return {
    id: image.id,
    url: image.url,
    mediumUrl: image.mediumUrl,
    thumbnailUrl: image.thumbnailUrl,
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary,
    // Same field the product endpoints return: what a numbered shawl's
    // numbers read to suggest their own colour, so a photo just uploaded
    // suggests one without waiting for a refetch.
    brightness: image.brightness,
    productId: image.productId,
    variantId: image.variantId,
    createdAt: image.createdAt,
  };
}

// Owner scope shared by an image's product or variant — used to resolve the
// target for upload/reorder and to scope "only one isPrimary" per owner.
function ownerWhere(owner: { productId?: string | null; variantId?: string | null }) {
  return owner.variantId ? { variantId: owner.variantId } : { productId: owner.productId };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(new AppError(400, ERROR_CODES.IMAGE_INVALID_TYPE));
      return;
    }
    cb(null, true);
  },
});

// Wraps multer so its errors (file too large, rejected type) flow through the
// same AppError -> unified envelope path as everything else, instead of
// multer's own default error format.
function handleUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
        next(new AppError(400, ERROR_CODES.IMAGE_TOO_LARGE));
        return;
      }
      next(err instanceof AppError ? err : new AppError(400, ERROR_CODES.IMAGE_UPLOAD_FAILED));
      return;
    }
    next();
  });
}

// ---------------------------------------------------------------------------
// POST /api/images — upload + process (sharp: thumbnail/medium/full WebP) +
// attach to a product OR a variant (Admin/Manager/Employee — "edit images").
// ---------------------------------------------------------------------------
router.post(
  "/",
  requirePermission("images.edit"),
  handleUpload,
  validateBody(uploadImageSchema),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, ERROR_CODES.IMAGE_FILE_REQUIRED);
    const body = req.body as UploadImageInput;

    if (body.productId) {
      const product = await prisma.product.findFirst({ where: { id: body.productId, deletedAt: null } });
      if (!product) throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);
    } else {
      const variant = await prisma.variant.findFirst({
        where: { id: body.variantId, product: { deletedAt: null } },
      });
      if (!variant) throw new AppError(404, ERROR_CODES.VARIANT_NOT_FOUND);
    }

    const where = ownerWhere(body);
    const existingCount = await prisma.productImage.count({ where });
    const stored = await storeProductImage(req.file.buffer);

    const created = await prisma.productImage.create({
      data: {
        filename: stored.filename,
        url: stored.urls.full,
        mediumUrl: stored.urls.medium,
        thumbnailUrl: stored.urls.thumbnail,
        // Only ever read to suggest a colour for a numbered shawl's numbers
        // (spec.md) — never to change the photograph itself.
        brightness: stored.brightness,
        sortOrder: existingCount,
        isPrimary: existingCount === 0, // first image for this owner becomes primary
        productId: body.productId ?? null,
        variantId: body.variantId ?? null,
      },
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.PRODUCT_IMAGE,
      entityId: created.id,
      newValue: created,
    });

    sendOk(res, serializeImage(created), null, 201);
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/images/reorder — bulk sortOrder update for one product's or
// variant's gallery (Admin/Manager/Employee).
// ---------------------------------------------------------------------------
router.patch(
  "/reorder",
  requirePermission("images.edit"),
  validateBody(reorderImagesSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as ReorderImagesInput;
    const where = ownerWhere(body);

    const existing = await prisma.productImage.findMany({ where });
    const existingIds = new Set(existing.map((i) => i.id));
    const requestedIds = new Set(body.imageIds);
    const sameSet = existingIds.size === requestedIds.size && [...existingIds].every((id) => requestedIds.has(id));
    if (!sameSet) throw new AppError(400, ERROR_CODES.IMAGE_REORDER_MISMATCH);

    await prisma.$transaction(
      body.imageIds.map((id, index) => prisma.productImage.update({ where: { id }, data: { sortOrder: index } }))
    );

    const updated = await prisma.productImage.findMany({ where, orderBy: { sortOrder: "asc" } });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: AUDIT_ENTITY.PRODUCT_IMAGE,
      entityId: body.productId ?? body.variantId!,
      oldValue: { order: existing.sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.id) },
      newValue: { order: body.imageIds },
    });

    sendOk(res, updated.map(serializeImage));
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/images/:id — set or clear isPrimary (Admin/Manager/Employee).
// Setting it true clears isPrimary on every other image of the same owner —
// at most one primary per product/variant.
// ---------------------------------------------------------------------------
router.patch(
  "/:id",
  requirePermission("images.edit"),
  validateBody(setPrimaryImageSchema),
  asyncHandler(async (req, res) => {
    const image = await prisma.productImage.findUnique({ where: { id: req.params.id } });
    if (!image) throw new AppError(404, ERROR_CODES.IMAGE_NOT_FOUND);

    const body = req.body as SetPrimaryImageInput;

    const [updated] = await prisma.$transaction([
      prisma.productImage.update({ where: { id: image.id }, data: { isPrimary: body.isPrimary } }),
      ...(body.isPrimary
        ? [
            prisma.productImage.updateMany({
              where: { ...ownerWhere(image), id: { not: image.id } },
              data: { isPrimary: false },
            }),
          ]
        : []),
    ]);

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: AUDIT_ENTITY.PRODUCT_IMAGE,
      entityId: image.id,
      oldValue: { isPrimary: image.isPrimary },
      newValue: { isPrimary: updated.isPrimary },
    });

    sendOk(res, serializeImage(updated));
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/images/:id — Admin/Manager delete the photo there and then.
//
// An Employee may add and reorder photos but not destroy one, so their delete
// becomes a REQUEST (spec.md "Employee change approvals") and the photo stays
// exactly where it is until an Admin agrees. Reaching this endpoint needs
// images.edit — the same permission that lets someone manage the gallery at
// all — and images.delete is what decides whether the photo actually goes.
// ---------------------------------------------------------------------------
router.delete(
  "/:id",
  requirePermission("images.edit"),
  asyncHandler(async (req, res) => {
    const image = await prisma.productImage.findUnique({ where: { id: req.params.id } });
    if (!image) throw new AppError(404, ERROR_CODES.IMAGE_NOT_FOUND);

    if (!can(req.user!, "images.delete")) {
      if (!can(req.user!, "changeRequest.create")) throw new AppError(403, ERROR_CODES.FORBIDDEN);

      // The photo belongs to a product or to one of its variants; either way
      // the approval screen wants the product's name to show WHICH gallery
      // this is, and the thumbnail so the Admin can see what would go.
      const owner = image.productId
        ? await prisma.product.findUnique({ where: { id: image.productId }, select: { id: true, name: true } })
        : await prisma.variant
            .findUnique({
              where: { id: image.variantId! },
              select: { product: { select: { id: true, name: true } } },
            })
            .then((v) => v?.product ?? null);

      const [filed] = await fileChangeRequests(req.user!, [
        {
          entityType: CHANGE_REQUEST_ENTITIES.PRODUCT_IMAGE,
          entityId: image.id,
          field: CHANGE_REQUEST_FIELDS.IMAGE_DELETION,
          // A photo has no name of its own; the gallery it is in is what
          // identifies it, together with the thumbnail below.
          entityLabel: null,
          productLabel: owner?.name ?? null,
          entityDetail: image.thumbnailUrl,
          productId: owner?.id ?? null,
          oldValue: deletionValue(false),
          newValue: deletionValue(true),
        },
      ]);
      // 202: accepted, not applied. The photo is still in the gallery.
      sendOk(res, { id: image.id, deleted: false, pendingChange: filed }, null, 202);
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: image.id } });
      // A photo that has gone cannot still be waiting to go.
      await cancelPendingChangesFor(tx, [
        { entityType: CHANGE_REQUEST_ENTITIES.PRODUCT_IMAGE, entityId: image.id },
      ]);
    });
    // Only once the row is gone: file deletion cannot be rolled back.
    await deleteProductImageFiles(image.filename);

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.PRODUCT_IMAGE,
      entityId: image.id,
      oldValue: image,
    });

    sendOk(res, { id: image.id, deleted: true });
  })
);

export default router;
