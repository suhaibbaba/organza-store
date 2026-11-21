import { Router } from "express";
import { AuditAction, Prisma, Role } from "@prisma/client";
import { APIError } from "better-auth";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody, validateQuery } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import {
  createStaffUser,
  hasUsablePassword,
  normalizeEmail,
  revokeAllSessions,
  setUserPassword,
  usersWithPassword,
} from "@/lib/credentials";
import { findUsersWithHistory, hasUserHistory } from "@/lib/userHistory";
import { sendPasswordSetupEmail } from "@/lib/passwordSetup";
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  type CreateUserInput,
  type ListUsersQuery,
  type UpdateUserInput,
} from "@/validation/user";
import { assertPhonesAvailable } from "@/lib/phone";
import { writeAudit } from "@/lib/audit";
import { AUDIT_ENTITY, ERROR_CODES } from "@/constants";
import type { SerializableUser } from "@/types";

// Staff management, Admin only (rule 5); the serializer strips Better Auth internals so no password hash ever leaves this file.
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

// hasPassword and hasHistory stay out of serializeUser, which also feeds the audit trail.
function serializeUserWithState(user: SerializableUser, hasPassword: boolean, hasHistory: boolean) {
  return { ...serializeUser(user), hasPassword, hasHistory };
}

// Single-account routes only; the list asks both questions once per page.
async function serializeUserForResponse(user: SerializableUser) {
  const [hasPassword, hasHistory] = await Promise.all([
    hasUsablePassword(user.id),
    hasUserHistory(user.id),
  ]);
  return serializeUserWithState(user, hasPassword, hasHistory);
}

// Refuses leaving the shop with no ACTIVE Admin: afterwards nothing in the app could undo it.
async function assertNotLastAdmin(
  existing: { id: string; role: Role; isActive: boolean },
  body: { role?: Role; isActive?: boolean }
): Promise<void> {
  const wasActiveAdmin = existing.role === Role.ADMIN && existing.isActive;
  if (!wasActiveAdmin) return;

  const stillActiveAdmin = (body.role ?? existing.role) === Role.ADMIN && (body.isActive ?? existing.isActive);
  if (stillActiveAdmin) return;

  const others = await prisma.user.count({
    where: { role: Role.ADMIN, isActive: true, id: { not: existing.id } },
  });
  if (others === 0) throw new AppError(409, ERROR_CODES.USER_LAST_ADMIN);
}

// GET /api/users
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
        orderBy: [{ [query.sortBy]: query.sortDir }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    // Asked once per page: hasHistory spans ten tables.
    const ids = users.map((user) => user.id);
    const [activated, withHistory] = await Promise.all([usersWithPassword(ids), findUsersWithHistory(ids)]);

    sendOk(res, users.map((user) => serializeUserWithState(user, activated.has(user.id), withHistory.has(user.id))), {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    });
  })
);

// GET /api/users/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError(404, ERROR_CODES.USER_NOT_FOUND);
    sendOk(res, await serializeUserForResponse(user));
  })
);

// POST /api/users
router.post(
  "/",
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateUserInput;

    // Compared in the same spelling the account is stored and signed in under.
    const email = normalizeEmail(body.email);
    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) throw new AppError(409, ERROR_CODES.EMAIL_DUPLICATE);
    await assertPhonesAvailable(body);

    // Internal adapter, not the disabled public sign-up; no password means no credential row (rule 17).
    let created: Awaited<ReturnType<typeof createStaffUser>>;
    try {
      created = await createStaffUser({
        email,
        name: body.name,
        role: body.role,
        phone: body.phone,
        whatsapp: body.whatsapp ?? null,
        idNumber: body.idNumber ?? null,
      });
    } catch (err) {
      if (err instanceof APIError) throw new AppError(400, ERROR_CODES.AUTH_SIGNUP_FAILED);
      throw err;
    }

    if (body.password) {
      await setUserPassword(created.id, body.password);
    }

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.USER,
      entityId: created.id,
      newValue: serializeUser(created),
    });

    // After commit and never awaited: a mail failure must not fail the create.
    if (!body.password) {
      await sendPasswordSetupEmail(created, "SET");
    }

    // A brand-new account has no history by construction.
    sendOk(res, serializeUserWithState(created, Boolean(body.password), false), null, 201);
  })
);

// POST /api/users/:id/password-reset — the link is also returned so it can be passed on when a mailbox is unreachable.
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

// POST /api/users/:id/resend-invite — the 72h set-up link; refused once a password exists or the account is inactive.
router.post(
  "/:id/resend-invite",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError(404, ERROR_CODES.USER_NOT_FOUND);
    if (!user.isActive) throw new AppError(409, ERROR_CODES.ACCOUNT_INACTIVE);
    if (await hasUsablePassword(user.id)) throw new AppError(409, ERROR_CODES.USER_ALREADY_ACTIVATED);

    const invite = await sendPasswordSetupEmail(user, "SET");

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.REQUEST,
      entityType: AUDIT_ENTITY.USER,
      entityId: user.id,
      // The link itself never goes into the trail.
      newValue: { passwordSetup: "RESENT", source: "ADMIN", expiresAt: invite.expiresAt },
    });

    // Returned for the same reason as the reset's.
    sendOk(res, { email: user.email, url: invite.url, expiresAt: invite.expiresAt });
  })
);

// PATCH /api/users/:id
router.patch(
  "/:id",
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, ERROR_CODES.USER_NOT_FOUND);

    const body = req.body as UpdateUserInput;
    await assertPhonesAvailable(body, existing.id);

    // Deactivating yourself is refused, and checked before the last-Admin rule since it is the truer reason.
    const deactivating = body.isActive === false && existing.isActive;
    if (deactivating && existing.id === req.user!.id) {
      throw new AppError(409, ERROR_CODES.USER_SELF_REMOVAL);
    }

    await assertNotLastAdmin(existing, body);

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

    // Deactivation must end their existing sessions, not just the next sign-in.
    if (deactivating) {
      await revokeAllSessions(updated.id);
    }

    // Admin-set fallback (rule 17), through lib/credentials.ts like the emailed link.
    if (body.password) {
      await setUserPassword(existing.id, body.password);
    }

    // Switching an account off is its own audit action, like PUBLISH/HIDE on a product.
    const action =
      body.isActive === undefined || body.isActive === existing.isActive
        ? AuditAction.UPDATE
        : body.isActive
          ? AuditAction.USER_REACTIVATED
          : AuditAction.USER_DEACTIVATED;

    await writeAudit({
      userId: req.user!.id,
      action,
      entityType: AUDIT_ENTITY.USER,
      entityId: updated.id,
      oldValue: serializeUser(existing),
      newValue: serializeUser(updated),
    });

    sendOk(res, await serializeUserForResponse(updated));
  })
);

// DELETE /api/users/:id — only for an account with no history (lib/userHistory.ts); `user.delete`, not `user.manage`.
router.delete(
  "/:id",
  requirePermission("user.delete"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, ERROR_CODES.USER_NOT_FOUND);

    // Deleting your own account is refused, like deactivating it.
    if (existing.id === req.user!.id) throw new AppError(409, ERROR_CODES.USER_SELF_REMOVAL);

    // Unreachable today; kept for the day `user.delete` is widened.
    await assertNotLastAdmin(existing, { isActive: false });

    // The real guard: optional relations would SetNull the authorship silently.
    if (await hasUserHistory(existing.id)) {
      throw new AppError(409, ERROR_CODES.USER_HAS_HISTORY);
    }

    // Written before the row goes, carrying the whole account: afterwards the trail is its only record.
    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.USER,
      entityId: existing.id,
      oldValue: serializeUser(existing),
      newValue: null,
    });

    // Backstop for a race between the check and the delete, answered with the same error.
    try {
      await prisma.user.delete({ where: { id: existing.id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw new AppError(409, ERROR_CODES.USER_HAS_HISTORY);
      }
      throw err;
    }

    sendOk(res, { id: existing.id, deleted: true });
  })
);

export default router;
