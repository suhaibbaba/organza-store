import { Router } from "express";
import { handleImageUpload } from "@/middleware/imageUpload";
import { AuditAction, Prisma, type ProductImage } from "@prisma/client";
import { can } from "@store/shared/lib/permissions";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import { deleteProductImageFiles, largestStoredFileName, recropProductImage, storeProductImage } from "@/lib/image";
import type { ImageEdit } from "@store/shared/lib/imageEdit";
import {
  editImageSchema,
  reorderImagesSchema,
  setPrimaryImageSchema,
  uploadImageSchema,
  type EditImageInput,
  type ReorderImagesInput,
  type SetPrimaryImageInput,
  type UploadImageInput,
} from "@/validation/image";
import { writeAudit } from "@/lib/audit";
import { queueOwnerSync } from "@/lib/search";
import { queueMarkedImages } from "@/lib/markedImage";
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
    // The original and the edit, for re-opening the editor; null on photos from before it existed.
    originalUrl: image.originalUrl,
    edit: (image.edit as ImageEdit | null) ?? null,
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary,
    // Same as the product endpoints: lets a fresh upload suggest numbered-shawl marker colours.
    brightness: image.brightness,
    productId: image.productId,
    variantId: image.variantId,
    createdAt: image.createdAt,
  };
}

// Owner scope (product or variant) for resolving uploads/reorders and one primary per owner.
function ownerWhere(owner: { productId?: string | null; variantId?: string | null }) {
  return owner.variantId ? { variantId: owner.variantId } : { productId: owner.productId };
}

// POST /api/images — upload, cut three WebP sizes, attach to a product or variant.
router.post(
  "/",
  requirePermission("images.edit"),
  handleImageUpload,
  validateBody(uploadImageSchema),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, ERROR_CODES.IMAGE_FILE_REQUIRED);
    }
    const body = req.body as UploadImageInput;

    if (body.productId) {
      const product = await prisma.product.findFirst({ where: { id: body.productId, deletedAt: null } });
      if (!product) {
        throw new AppError(404, ERROR_CODES.PRODUCT_NOT_FOUND);
      }
    } else {
      const variant = await prisma.variant.findFirst({
        where: { id: body.variantId, product: { deletedAt: null } },
      });
      if (!variant) {
        throw new AppError(404, ERROR_CODES.VARIANT_NOT_FOUND);
      }
    }

    const where = ownerWhere(body);
    const existingCount = await prisma.productImage.count({ where });
    // The file arrives untouched, with the framing as numbers — never a browser canvas re-encode.
    const stored = await storeProductImage(req.file.buffer, body.edit ?? null);

    const created = await prisma.productImage.create({
      data: {
        filename: stored.filename,
        url: stored.urls.full,
        mediumUrl: stored.urls.medium,
        thumbnailUrl: stored.urls.thumbnail,
        // Only used to suggest marker colours; never changes the photo.
        brightness: stored.brightness,
        originalFilename: stored.originalFilename,
        originalUrl: stored.originalUrl,
        edit: body.edit ?? Prisma.DbNull,
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
    await queueOwnerSync(created);
    queueMarkedImages([created.productId]);

    sendOk(res, serializeImage(created), null, 201);
  }),
);

// PATCH /api/images/reorder — bulk sortOrder update for one product's or variant's gallery (Admin/Manager/Employee).
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
    if (!sameSet) {
      throw new AppError(400, ERROR_CODES.IMAGE_REORDER_MISMATCH);
    }

    await prisma.$transaction(
      body.imageIds.map((id, index) => prisma.productImage.update({ where: { id }, data: { sortOrder: index } })),
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
    await queueOwnerSync(body);
    queueMarkedImages([body.productId]);

    sendOk(res, updated.map(serializeImage));
  }),
);

// PATCH /api/images/:id — set or clear isPrimary; at most one primary per owner.
router.patch(
  "/:id",
  requirePermission("images.edit"),
  validateBody(setPrimaryImageSchema),
  asyncHandler(async (req, res) => {
    const image = await prisma.productImage.findUnique({ where: { id: req.params.id } });
    if (!image) {
      throw new AppError(404, ERROR_CODES.IMAGE_NOT_FOUND);
    }

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
    await queueOwnerSync(image);
    queueMarkedImages([image.productId]);

    sendOk(res, serializeImage(updated));
  }),
);

// PATCH /api/images/:id/edit — re-frame from the kept original at full quality, no new upload.
router.patch(
  "/:id/edit",
  requirePermission("images.edit"),
  validateBody(editImageSchema),
  asyncHandler(async (req, res) => {
    const image = await prisma.productImage.findUnique({ where: { id: req.params.id } });
    if (!image) {
      throw new AppError(404, ERROR_CODES.IMAGE_NOT_FOUND);
    }

    // A photo with no original is re-framed from its largest size, which becomes its original.
    const source = image.originalFilename
      ? { filename: image.originalFilename, isOriginal: true }
      : { filename: largestStoredFileName(image.filename), isOriginal: false };

    const { edit } = req.body as EditImageInput;
    const stored = await recropProductImage(source, edit);

    const updated = await prisma.productImage.update({
      where: { id: image.id },
      data: {
        filename: stored.filename,
        url: stored.urls.full,
        mediumUrl: stored.urls.medium,
        thumbnailUrl: stored.urls.thumbnail,
        brightness: stored.brightness,
        originalFilename: stored.originalFilename,
        originalUrl: stored.originalUrl,
        edit,
      },
    });

    // Old files are deleted only once the row points at the new ones; the original is never among them.
    await deleteProductImageFiles(image.filename);

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: AUDIT_ENTITY.PRODUCT_IMAGE,
      entityId: image.id,
      oldValue: { url: image.url, edit: image.edit },
      newValue: { url: updated.url, edit },
    });
    await queueOwnerSync(image);
    queueMarkedImages([image.productId]);

    sendOk(res, serializeImage(updated));
  }),
);

// DELETE /api/images/:id — immediate for Admin/Manager; an Employee's becomes a request (images.delete decides).
router.delete(
  "/:id",
  requirePermission("images.edit"),
  asyncHandler(async (req, res) => {
    const image = await prisma.productImage.findUnique({ where: { id: req.params.id } });
    if (!image) {
      throw new AppError(404, ERROR_CODES.IMAGE_NOT_FOUND);
    }

    if (!can(req.user!, "images.delete")) {
      if (!can(req.user!, "changeRequest.create")) {
        throw new AppError(403, ERROR_CODES.FORBIDDEN);
      }

      // The approval screen shows which product's gallery this is, with the thumbnail.
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
          // A photo has no name; its gallery and thumbnail identify it.
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
      await cancelPendingChangesFor(tx, [{ entityType: CHANGE_REQUEST_ENTITIES.PRODUCT_IMAGE, entityId: image.id }]);
    });
    // Only once the row is gone: file deletion cannot be rolled back.
    await deleteProductImageFiles(image.filename, image.originalFilename);

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.PRODUCT_IMAGE,
      entityId: image.id,
      oldValue: image,
    });
    await queueOwnerSync(image);
    queueMarkedImages([image.productId]);

    sendOk(res, { id: image.id, deleted: true });
  }),
);

export default router;
