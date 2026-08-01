import { Router } from "express";
import { AuditAction, Role } from "@prisma/client";
import { APIError } from "better-auth";
import { hashPassword } from "better-auth/crypto";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { AppError, sendOk } from "../lib/response";
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  type CreateUserInput,
  type ListUsersQuery,
  type UpdateUserInput,
} from "../validation/user";
import { findUserByPhoneField } from "../lib/phone";
import { writeAudit } from "../lib/audit";

// Staff management — Admin only (CLAUDE.md rule 5). `idNumber` is Admin-only
// data (rule 19); since this whole router is Admin-gated that's automatically
// satisfied, but the serializer still exists to keep the shape explicit and
// to strip Better Auth internals (no password/hash ever leaves this file).
const router = Router();
router.use(requireAuth, requireRole(Role.ADMIN));

function serializeUser(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string;
  whatsapp: string | null;
  idNumber: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    whatsapp: user.whatsapp,
    idNumber: user.idNumber,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function assertPhonesAvailable(input: { phone?: string; whatsapp?: string | null }, excludeUserId?: string) {
  if (input.phone) {
    const dupe = await findUserByPhoneField("phone", input.phone, excludeUserId);
    if (dupe) throw new AppError(409, "error.phone.duplicate");
  }
  if (input.whatsapp) {
    const dupe = await findUserByPhoneField("whatsapp", input.whatsapp, excludeUserId);
    if (dupe) throw new AppError(409, "error.whatsapp.duplicate");
  }
}

// ---------------------------------------------------------------------------
// GET /api/users — list staff (pagination + filtering)
// ---------------------------------------------------------------------------
router.get(
  "/",
  validateQuery(listUsersQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListUsersQuery;
    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" as const } },
              { email: { contains: query.q, mode: "insensitive" as const } },
              { phone: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    sendOk(res, users.map(serializeUser), {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /api/users/:id — detail
// ---------------------------------------------------------------------------
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError(404, "error.user.not_found");
    sendOk(res, serializeUser(user));
  })
);

// ---------------------------------------------------------------------------
// POST /api/users — create a staff account via Better Auth
// ---------------------------------------------------------------------------
router.post(
  "/",
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateUserInput;

    const emailTaken = await prisma.user.findUnique({ where: { email: body.email } });
    if (emailTaken) throw new AppError(409, "error.email.duplicate");
    await assertPhonesAvailable(body);

    let userId: string;
    try {
      const result = await auth.api.signUpEmail({
        body: { email: body.email, password: body.password, name: body.name, phone: body.phone },
      });
      userId = result.user.id;
    } catch (err) {
      if (err instanceof APIError) throw new AppError(400, "error.auth.signup_failed");
      throw err;
    }

    const created = await prisma.user.update({
      where: { id: userId },
      data: {
        role: body.role,
        whatsapp: body.whatsapp ?? null,
        idNumber: body.idNumber ?? null,
      },
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: "User",
      entityId: created.id,
      newValue: serializeUser(created),
    });

    sendOk(res, serializeUser(created), null, 201);
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/users/:id — update profile / role / deactivate / reset password
// ---------------------------------------------------------------------------
router.patch(
  "/:id",
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "error.user.not_found");

    const body = req.body as UpdateUserInput;
    await assertPhonesAvailable(body, existing.id);

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: body.name,
        role: body.role,
        phone: body.phone,
        whatsapp: body.whatsapp === undefined ? undefined : body.whatsapp,
        idNumber: body.idNumber === undefined ? undefined : body.idNumber,
        isActive: body.isActive,
      },
    });

    // Admin-driven reset (CLAUDE.md rule 17) — hash with Better Auth's own
    // hasher and write straight to the credential Account row, same
    // algorithm Better Auth itself would use on sign-up.
    if (body.password) {
      const passwordHash = await hashPassword(body.password);
      const account = await prisma.account.findFirst({
        where: { userId: existing.id, providerId: "credential" },
      });
      if (account) {
        await prisma.account.update({ where: { id: account.id }, data: { password: passwordHash } });
      } else {
        await prisma.account.create({
          data: { userId: existing.id, providerId: "credential", accountId: existing.id, password: passwordHash },
        });
      }
    }

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: updated.id,
      oldValue: serializeUser(existing),
      newValue: serializeUser(updated),
    });

    sendOk(res, serializeUser(updated));
  })
);

export default router;
