import { Router } from "express";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import {
  addOptionValueSchema,
  createVariantTypeSchema,
  type AddOptionValueInput,
  type CreateVariantTypeInput,
} from "@/validation/variantType";
import { generateUniqueSlug, toSlug } from "@/lib/slug";
import { writeAudit } from "@/lib/audit";
import { AUDIT_ENTITY, ERROR_CODES } from "@/constants";

// Global variant types/values (Color, Size, Number, ...), shared across all
// products. Creation here is what powers the "inline add" flow from the
// product screen (spec.md "Inline add") — Employees can use it too, since
// it's part of "add products".
const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const types = await prisma.variantType.findMany({
      include: { values: { orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    sendOk(res, types);
  })
);

router.post(
  "/",
  requirePermission("variantType.manage"),
  validateBody(createVariantTypeSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateVariantTypeInput;

    const slug = await generateUniqueSlug(body.name.ar, async (candidate) => {
      const existing = await prisma.variantType.findUnique({ where: { slug: candidate } });
      return Boolean(existing);
    });

    const type = await prisma.variantType.create({ data: { name: body.name, slug } });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.VARIANT_TYPE,
      entityId: type.id,
      newValue: type,
    });

    sendOk(res, type, null, 201);
  })
);

router.post(
  "/:id/values",
  requirePermission("variantType.manage"),
  validateBody(addOptionValueSchema),
  asyncHandler(async (req, res) => {
    const type = await prisma.variantType.findUnique({ where: { id: req.params.id } });
    if (!type) throw new AppError(404, ERROR_CODES.VARIANT_TYPE_NOT_FOUND);

    const body = req.body as AddOptionValueInput;
    const key = toSlug(body.value.ar);

    const existing = await prisma.variantOptionValue.findUnique({
      where: { variantTypeId_key: { variantTypeId: type.id, key } },
    });
    if (existing) throw new AppError(409, ERROR_CODES.VARIANT_TYPE_VALUE_DUPLICATE);

    const sortOrder = await prisma.variantOptionValue.count({ where: { variantTypeId: type.id } });
    const value = await prisma.variantOptionValue.create({
      data: { variantTypeId: type.id, key, value: body.value, sortOrder },
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.VARIANT_OPTION_VALUE,
      entityId: value.id,
      newValue: value,
    });

    sendOk(res, value, null, 201);
  })
);

export default router;
