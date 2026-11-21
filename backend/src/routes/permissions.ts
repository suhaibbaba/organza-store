import { Router } from "express";
import { AuditAction, type Role } from "@prisma/client";
import {
  buildPermissionMatrixPayload,
  isConfigurableAction,
  isFixedRole,
  isProtectedAction,
} from "@store/shared/lib/permissions";
import { DEFAULT_ROLE_PERMISSIONS } from "@store/shared/constants/permissions";
import type { ConfigurableAction } from "@store/shared/types/permission";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import { writeAudit } from "@/lib/audit";
import { invalidatePermissionConfig } from "@/lib/permissionConfig";
import { updateRolePermissionsSchema, type UpdateRolePermissionsInput } from "@/validation/permission";
import { AUDIT_ENTITY, ERROR_CODES } from "@/constants";

// Who may do what: readable by any signed-in user (clients call can() too), writable by an Admin.
const router = Router();
router.use(requireAuth);

// Straight out of can(), never re-derived, so the screen can never disagree with the gate.
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    sendOk(res, buildPermissionMatrixPayload());
  }),
);

router.patch(
  "/",
  requirePermission("permission.manage"),
  validateBody(updateRolePermissionsSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as UpdateRolePermissionsInput;
    const role = body.role as Role;
    const actor = req.user!;

    // Guard 1: nobody edits their own role's authority.
    if (role === actor.role) {
      throw new AppError(409, ERROR_CODES.PERMISSION_SELF_ROLE);
    }

    // Guard 1b: nobody edits the ADMIN row — an Admin always holds everything, and can() ignores stored rows for it.
    if (isFixedRole(role)) {
      throw new AppError(409, ERROR_CODES.PERMISSION_ADMIN_ROLE);
    }

    // Guard 2: a PROTECTED action is refused by the server (none today; kept so re-locking is one entry in shared).
    for (const change of body.changes) {
      if (isProtectedAction(change.action) || !isConfigurableAction(change.action)) {
        throw new AppError(403, ERROR_CODES.PERMISSION_ACTION_PROTECTED);
      }
    }

    const existing = await prisma.rolePermission.findMany({ where: { role } });
    const currentByAction = new Map(existing.map((row) => [row.action, row.granted]));

    // Resolved before the write so the audit entry says what it changed from; a missing row reads as the shipped default.
    const applied = body.changes
      .map((change) => {
        const action = change.action as ConfigurableAction;
        const before = currentByAction.get(action) ?? DEFAULT_ROLE_PERMISSIONS[role].includes(action);
        return { action, before, after: change.granted };
      })
      // A tick that changes nothing is neither an error nor a decision: no audit entry.
      .filter((change) => change.before !== change.after);

    if (applied.length > 0) {
      await prisma.$transaction(
        applied.map((change) =>
          prisma.rolePermission.upsert({
            where: { role_action: { role, action: change.action } },
            create: { role, action: change.action, granted: change.after, updatedById: actor.id },
            update: { granted: change.after, updatedById: actor.id },
          }),
        ),
      );

      // One audit entry per grant (rule 6), so "when did Employees get this?" is answerable by filtering.
      for (const change of applied) {
        await writeAudit({
          userId: actor.id,
          action: change.after ? AuditAction.PERMISSION_GRANTED : AuditAction.PERMISSION_REVOKED,
          entityType: AUDIT_ENTITY.ROLE_PERMISSION,
          entityId: role,
          oldValue: { role, action: change.action, granted: change.before },
          newValue: { role, action: change.action, granted: change.after },
        });
      }

      // This process refreshes at once; others notice within PERMISSION_CACHE_TTL_MS.
      await invalidatePermissionConfig();
    }

    sendOk(res, {
      ...buildPermissionMatrixPayload(),
      // What this request changed, so the screen needn't diff two matrices.
      changed: applied.map((change) => ({ action: change.action, granted: change.after })),
    });
  }),
);

export default router;
