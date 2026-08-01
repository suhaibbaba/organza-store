import { Router } from "express";
import { AuditAction, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { AppError, sendOk } from "../lib/response";
import { addOptionValueSchema, createVariantTypeSchema, type AddOptionValueInput, type CreateVariantTypeInput } from "../validation/variantType";
import { generateUniqueSlug, toSlug } from "../lib/slug";
import { writeAudit } from "../lib/audit";

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
  requireRole(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE),
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
      entityType: "VariantType",
      entityId: type.id,
      newValue: type,
    });

    sendOk(res, type, null, 201);
  })
);

router.post(
  "/:id/values",
  requireRole(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE),
  validateBody(addOptionValueSchema),
  asyncHandler(async (req, res) => {
    const type = await prisma.variantType.findUnique({ where: { id: req.params.id } });
    if (!type) throw new AppError(404, "error.variantType.not_found");

    const body = req.body as AddOptionValueInput;
    const key = toSlug(body.value.ar);

    const existing = await prisma.variantOptionValue.findUnique({
      where: { variantTypeId_key: { variantTypeId: type.id, key } },
    });
    if (existing) throw new AppError(409, "error.variantType.value_duplicate");

    const sortOrder = await prisma.variantOptionValue.count({ where: { variantTypeId: type.id } });
    const value = await prisma.variantOptionValue.create({
      data: { variantTypeId: type.id, key, value: body.value, sortOrder },
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: "VariantOptionValue",
      entityId: value.id,
      newValue: value,
    });

    sendOk(res, value, null, 201);
  })
);

export default router;
