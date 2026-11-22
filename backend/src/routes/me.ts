import { Router } from "express";
import { AuditAction, type User } from "@prisma/client";
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from "@store/shared/schemas/profile";
import type { Profile, ProfilePasskey, ProfileSession } from "@store/shared/types/profile";
import type { SupportedLanguage } from "@store/shared/types/language";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth } from "@/middleware/auth";
import { validateBody } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import { assertPhonesAvailable } from "@/lib/phone";
import { revokeOtherSessions, setUserPassword, verifyUserPassword } from "@/lib/credentials";
import { auth } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getAuthenticatorName } from "@better-auth/passkey";
import { AUDIT_ENTITY, ERROR_CODES, PROFILE_PASSKEYS_LIMIT, PROFILE_SESSIONS_LIMIT } from "@/constants";

// The signed-in person's own account: no permission beyond being signed in, and never another account.
const router = Router();
router.use(requireAuth);

function toProfile(user: User): Profile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    whatsapp: user.whatsapp,
    locale: (user.locale as SupportedLanguage | null) ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

function auditFields(user: User) {
  return { name: user.name, phone: user.phone, whatsapp: user.whatsapp, locale: user.locale };
}

async function loadSelf(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, ERROR_CODES.USER_NOT_FOUND);
  }
  return user;
}

// GET /api/me
router.get(
  "/",
  asyncHandler(async (req, res) => {
    sendOk(res, toProfile(await loadSelf(req.user!.id)));
  }),
);

// PATCH /api/me
router.patch(
  "/",
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const existing = await loadSelf(req.user!.id);
    const body = req.body as UpdateProfileInput;
    await assertPhonesAvailable(body, existing.id);

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: body.name,
        phone: body.phone,
        whatsapp: body.whatsapp === undefined ? undefined : body.whatsapp,
        locale: body.locale,
      },
    });

    await writeAudit({
      userId: existing.id,
      action: AuditAction.UPDATE,
      entityType: AUDIT_ENTITY.USER,
      entityId: existing.id,
      oldValue: auditFields(existing),
      newValue: auditFields(updated),
    });

    sendOk(res, toProfile(updated));
  }),
);

// POST /api/me/password — the current password is required, and every other device is signed out.
router.post(
  "/password",
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const body = req.body as ChangePasswordInput;
    if (!(await verifyUserPassword(userId, body.currentPassword))) {
      throw new AppError(400, ERROR_CODES.PROFILE_WRONG_PASSWORD);
    }

    await setUserPassword(userId, body.newPassword);
    await revokeOtherSessions(userId, req.sessionId);

    await writeAudit({
      userId,
      action: AuditAction.PASSWORD_CHANGED,
      entityType: AUDIT_ENTITY.USER,
      entityId: userId,
      oldValue: null,
      newValue: { otherSessionsSignedOut: true },
    });

    sendOk(res, { changed: true });
  }),
);

// GET /api/me/sessions
router.get(
  "/sessions",
  asyncHandler(async (req, res) => {
    const where = { userId: req.user!.id, expiresAt: { gt: new Date() } };
    const [rows, total] = await Promise.all([
      prisma.session.findMany({ where, orderBy: { updatedAt: "desc" }, take: PROFILE_SESSIONS_LIMIT }),
      prisma.session.count({ where }),
    ]);
    const sessions: ProfileSession[] = rows.map((row) => ({
      id: row.id,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
      lastActiveAt: row.updatedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      current: row.id === req.sessionId,
    }));
    sendOk(res, sessions, {
      page: 1,
      pageSize: PROFILE_SESSIONS_LIMIT,
      total,
      totalPages: Math.max(1, Math.ceil(total / PROFILE_SESSIONS_LIMIT)),
    });
  }),
);

// DELETE /api/me/sessions — every device but this one.
router.delete(
  "/sessions",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    await revokeOtherSessions(userId, req.sessionId);
    await writeAudit({
      userId,
      action: AuditAction.SESSION_REVOKED,
      entityType: AUDIT_ENTITY.USER,
      entityId: userId,
      oldValue: null,
      newValue: { scope: "others" },
    });
    sendOk(res, { revoked: true });
  }),
);

// DELETE /api/me/sessions/:id — one other device; this one signs out through the normal sign-out.
router.delete(
  "/sessions/:id",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const session = await prisma.session.findFirst({ where: { id: req.params.id, userId } });
    if (!session || session.id === req.sessionId) {
      throw new AppError(404, ERROR_CODES.PROFILE_SESSION_NOT_FOUND);
    }

    const ctx = await auth.$context;
    await ctx.internalAdapter.deleteSession(session.token);
    await writeAudit({
      userId,
      action: AuditAction.SESSION_REVOKED,
      entityType: AUDIT_ENTITY.USER,
      entityId: userId,
      oldValue: { sessionId: session.id, userAgent: session.userAgent },
      newValue: null,
    });
    sendOk(res, { revoked: true });
  }),
);

// GET /api/me/passkeys
router.get(
  "/passkeys",
  asyncHandler(async (req, res) => {
    const where = { userId: req.user!.id };
    const [rows, total] = await Promise.all([
      prisma.passkey.findMany({ where, orderBy: { createdAt: "desc" }, take: PROFILE_PASSKEYS_LIMIT }),
      prisma.passkey.count({ where }),
    ]);
    const passkeys: ProfilePasskey[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      provider: getAuthenticatorName(row.aaguid ?? undefined) ?? null,
      synced: row.backedUp,
      createdAt: row.createdAt?.toISOString() ?? null,
    }));
    sendOk(res, passkeys, {
      page: 1,
      pageSize: PROFILE_PASSKEYS_LIMIT,
      total,
      totalPages: Math.max(1, Math.ceil(total / PROFILE_PASSKEYS_LIMIT)),
    });
  }),
);

// DELETE /api/me/passkeys/:id — the device keeps its copy, but this account stops accepting it.
router.delete(
  "/passkeys/:id",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const passkey = await prisma.passkey.findFirst({ where: { id: req.params.id, userId } });
    if (!passkey) {
      throw new AppError(404, ERROR_CODES.PROFILE_PASSKEY_NOT_FOUND);
    }
    await prisma.passkey.delete({ where: { id: passkey.id } });
    await writeAudit({
      userId,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.PASSKEY,
      entityId: passkey.id,
      oldValue: { deviceType: passkey.deviceType, createdAt: passkey.createdAt },
      newValue: null,
    });
    sendOk(res, { removed: true });
  }),
);

export default router;
