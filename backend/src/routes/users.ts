import crypto from "node:crypto";
import { Router } from "express";
import { AuditAction } from "@prisma/client";
import { APIError } from "better-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody, validateQuery } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import { setUserPassword } from "@/lib/credentials";
import { sendPasswordSetupEmail } from "@/lib/passwordSetup";
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  type CreateUserInput,
  type ListUsersQuery,
  type UpdateUserInput,
} from "@/validation/user";
import { findUserByPhoneField } from "@/lib/phone";
import { writeAudit } from "@/lib/audit";
import { AUDIT_ENTITY, AUTH_PROVIDER_CREDENTIAL, ERROR_CODES } from "@/constants";
import { PASSWORD_TOKEN_BYTES } from "@shared/constants/passwordSetup";
import type { SerializableUser } from "@/types";

// Staff management — Admin only (CLAUDE.md rule 5). `idNumber` is Admin-only
// data (rule 19); since this whole router is Admin-gated that's automatically
// satisfied, but the serializer still exists to keep the shape explicit and
// to strip Better Auth internals (no password/hash ever leaves this file).
const router = Router();
router.use(requireAuth, requirePermission("user.manage"));

function serializeUser(user: SerializableUser) {
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
    if (dupe) throw new AppError(409, ERROR_CODES.PHONE_DUPLICATE);
  }
  if (input.whatsapp) {
    const dupe = await findUserByPhoneField("whatsapp", input.whatsapp, excludeUserId);
    if (dupe) throw new AppError(409, ERROR_CODES.WHATSAPP_DUPLICATE);
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
    if (!user) throw new AppError(404, ERROR_CODES.USER_NOT_FOUND);
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
    if (emailTaken) throw new AppError(409, ERROR_CODES.EMAIL_DUPLICATE);
    await assertPhonesAvailable(body);

    // Better Auth's sign-up always wants a password, so an account that is
    // meant to have none is created with a throwaway one and then stripped of
    // it below. Nobody ever sees this value — not the Admin creating the
    // account, not the log, not the response.
    const throwawayPassword = crypto.randomBytes(PASSWORD_TOKEN_BYTES).toString("base64url");

    let userId: string;
    try {
      const result = await auth.api.signUpEmail({
        body: {
          email: body.email,
          password: body.password ?? throwawayPassword,
          name: body.name,
          phone: body.phone,
        },
      });
      userId = result.user.id;
    } catch (err) {
      if (err instanceof APIError) throw new AppError(400, ERROR_CODES.AUTH_SIGNUP_FAILED);
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

    // No password given => the account genuinely has none. The hash is
    // cleared rather than left as the throwaway, so there is no secret in
    // the database that would let anybody in if it ever leaked.
    if (!body.password) {
      await prisma.account.updateMany({
        where: { userId: created.id, providerId: AUTH_PROVIDER_CREDENTIAL },
        data: { password: null },
      });
    }

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.USER,
      entityId: created.id,
      newValue: serializeUser(created),
    });

    // After the writes, never inside them, and never awaited on the mail
    // itself: a mail provider having a bad afternoon must not turn "the
    // account was created" into a 500 (see lib/email/index.ts). If it fails,
    // it lands in error tracking and the Admin can send another from the
    // users screen.
    if (!body.password) {
      await sendPasswordSetupEmail(created, "SET");
    }

    sendOk(res, serializeUser(created), null, 201);
  })
);

// ---------------------------------------------------------------------------
// POST /api/users/:id/password-reset — email this person a set-password link
//
// Admin only, like everything else on this router. The link is single-use and
// short-lived, and issuing it invalidates any earlier one.
//
// The link is RETURNED as well as emailed, deliberately: an Admin already
// holds unrestricted password authority over every account (PATCH below sets
// one outright), so this hands them nothing they did not have — and it is
// what lets the shop pass a link over WhatsApp when somebody's mailbox is
// unreachable, which is the situation this whole flow has to survive.
// ---------------------------------------------------------------------------
router.post(
  "/:id/password-reset",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError(404, ERROR_CODES.USER_NOT_FOUND);

    const invite = await sendPasswordSetupEmail(user, "RESET");

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.REQUEST,
      entityType: AUDIT_ENTITY.USER,
      entityId: user.id,
      // The link itself is never written to the trail.
      newValue: { passwordReset: "REQUESTED", source: "ADMIN", expiresAt: invite.expiresAt },
    });

    sendOk(res, { email: user.email, url: invite.url, expiresAt: invite.expiresAt });
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
    if (!existing) throw new AppError(404, ERROR_CODES.USER_NOT_FOUND);

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

    // The admin-set fallback (CLAUDE.md rule 17), kept alongside the emailed
    // link for the member of staff whose mailbox is unreachable. Hashing and
    // the credential-account write live in lib/credentials.ts, shared with
    // the emailed-link path so the two can never drift apart.
    if (body.password) {
      await setUserPassword(existing.id, body.password);
    }

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: AUDIT_ENTITY.USER,
      entityId: updated.id,
      oldValue: serializeUser(existing),
      newValue: serializeUser(updated),
    });

    sendOk(res, serializeUser(updated));
  })
);

export default router;
