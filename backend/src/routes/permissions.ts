import { Router } from "express";
import { AuditAction, type Role } from "@prisma/client";
import {
  buildPermissionMatrixPayload,
  isConfigurableAction,
  isProtectedAction,
} from "@organza/shared/lib/permissions";
import { DEFAULT_ROLE_PERMISSIONS } from "@organza/shared/constants/permissions";
import type { ConfigurableAction } from "@organza/shared/types/permission";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import { writeAudit } from "@/lib/audit";
import { invalidatePermissionConfig } from "@/lib/permissionConfig";
import { updateRolePermissionsSchema, type UpdateRolePermissionsInput } from "@/validation/permission";
import { AUDIT_ENTITY, ERROR_CODES } from "@/constants";

// Who may do what (spec.md "Editable role permissions").
//
// READABLE by any signed-in user, WRITABLE by an Admin. The read is wide on
// purpose: admin and pos call `can()` on the client to decide what to show,
// and they can only agree with this server if they are told the same rules it
// is using. Nothing here is shop data — it is the shop's own configuration,
// the backend enforces every one of these actions regardless of what a client
// believes, and a client that was NOT told would fall back to the shipped
// defaults and show buttons this shop had switched off.
const router = Router();
router.use(requireAuth);

// The rules as they stand right now, straight out of `can()` — deliberately
// not re-derived from the table here. If this endpoint computed the answer
// its own way, the screen could disagree with the gate, and the screen would
// be believed. There is one resolver, and this asks it.
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    sendOk(res, buildPermissionMatrixPayload());
  })
);

router.patch(
  "/",
  requirePermission("permission.manage"),
  validateBody(updateRolePermissionsSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as UpdateRolePermissionsInput;
    const role = body.role as Role;
    const actor = req.user!;

    // GUARD 1 — nobody adjusts their own authority.
    //
    // An Admin editing the ADMIN row is editing what they themselves may do.
    // That is the one edit whose subject and author are the same person, and
    // it is also the only route by which the last Admin could take something
    // away from themselves that nothing in the app could give back. Refused
    // outright rather than warned about.
    //
    // (The other half of that promise lives in routes/users.ts, which refuses
    // to demote or deactivate the last active Admin — USER_LAST_ADMIN. The two
    // together are what make "locked out of your own shop" unreachable.)
    if (role === actor.role) {
      throw new AppError(409, ERROR_CODES.PERMISSION_SELF_ROLE);
    }

    // GUARD 2 — a PROTECTED action is refused by the SERVER.
    //
    // This is the refusal that matters. The screen never draws a checkbox for
    // a protected action, but the anti-theft design cannot depend on a client
    // behaving — a curl with an Admin's token is a client too. The schema
    // deliberately does NOT do this job (it accepts any real action, so that
    // "not an action" and "not yours to change" are told apart), which leaves
    // exactly one place where the rule lives, and it is this one.
    //
    // `isConfigurableAction` is checked as well as `isProtectedAction`: the
    // two are complements today, and a request must be refused if it names
    // something that is neither — an action added to PERMISSION_ACTIONS and to
    // no list, on a build where the load-time check in shared has somehow been
    // bypassed. Default deny, not default configure.
    for (const change of body.changes) {
      if (isProtectedAction(change.action) || !isConfigurableAction(change.action)) {
        throw new AppError(403, ERROR_CODES.PERMISSION_ACTION_PROTECTED);
      }
    }

    const existing = await prisma.rolePermission.findMany({ where: { role } });
    const currentByAction = new Map(existing.map((row) => [row.action, row.granted]));

    // What each change actually does, resolved BEFORE the write so the audit
    // entry can say what it changed FROM. A row that does not exist yet reads
    // as the shipped default, which is the same fallback `can()` uses.
    const applied = body.changes
      .map((change) => {
        const action = change.action as ConfigurableAction;
        const before =
          currentByAction.get(action) ?? DEFAULT_ROLE_PERMISSIONS[role].includes(action);
        return { action, before, after: change.granted };
      })
      // A tick that changes nothing is not an error — the screen may re-send
      // state it already had — but it is not a decision either, so it writes
      // no audit entry and does not pretend to be one.
      .filter((change) => change.before !== change.after);

    if (applied.length > 0) {
      await prisma.$transaction(
        applied.map((change) =>
          prisma.rolePermission.upsert({
            where: { role_action: { role, action: change.action } },
            create: { role, action: change.action, granted: change.after, updatedById: actor.id },
            update: { granted: change.after, updatedById: actor.id },
          })
        )
      );

      // ONE ENTRY PER GRANT (CLAUDE.md rule 6): who, which role, which action,
      // on or off. Not one entry per request carrying a blob of changes — the
      // question somebody will ask this trail is "when did Employees get
      // this?", and that has to be answerable by filtering.
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

      // This process picks the change up before it answers, so whoever just
      // tapped the box is never shown the state they replaced. Other
      // processes notice within PERMISSION_CACHE_TTL_MS (lib/permissionConfig.ts).
      await invalidatePermissionConfig();
    }

    sendOk(res, {
      ...buildPermissionMatrixPayload(),
      // What this request actually changed, so the screen can say so plainly
      // instead of diffing two matrices to find out.
      changed: applied.map((change) => ({ action: change.action, granted: change.after })),
    });
  })
);

export default router;
