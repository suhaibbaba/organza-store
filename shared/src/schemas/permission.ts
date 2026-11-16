import { z } from "zod";
import { ROLES } from "@/constants/roles";
import { CONFIGURABLE_ACTIONS, PERMISSION_ACTIONS } from "@/constants/permissions";

// One PATCH edits ONE role, because that is the question being answered:
// "what may a Manager do?". The screen sends a single change as the checkbox
// is tapped; a run of them (which is what a test resetting the table sends)
// is the same request with a longer list.
//
// The enum is EVERY action, not only the configurable ones — deliberately.
// Naming a protected action is not a malformed request, it is a refused one,
// and the two should not answer the same way: "error.validation, expected one
// of these thirty strings" says nothing about why order.cancel is not among
// them. So the shape is checked here and the RULE is enforced in the route
// (backend/src/routes/permissions.ts), which answers 403
// PERMISSION_ACTION_PROTECTED — a refusal somebody reading the log can act on.
// A string that is not an action at all still fails here, where it should.
const permissionAction = z.enum(PERMISSION_ACTIONS as unknown as [string, ...string[]]);

export const updateRolePermissionsSchema = z.object({
  role: z.enum(ROLES),
  changes: z
    .array(
      z.object({
        action: permissionAction,
        granted: z.boolean(),
      })
    )
    .min(1)
    // No more entries than there are actions to switch. A body repeating the
    // same action ten thousand times is not a permissions edit.
    .max(CONFIGURABLE_ACTIONS.length)
    // ...and not the same action twice in one request either, which would
    // make "what did this change do" unanswerable from the audit trail.
    .refine(
      (changes) => new Set(changes.map((change) => change.action)).size === changes.length,
      { message: "duplicate action" }
    ),
});

export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
