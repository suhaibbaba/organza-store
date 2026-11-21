import { z } from "zod";
import { ROLES } from "@/constants/roles";
import { CONFIGURABLE_ACTIONS, PERMISSION_ACTIONS } from "@/constants/permissions";

// One PATCH edits one role; the enum is every action so a protected one gets 403 PERMISSION_ACTION_PROTECTED from the route, not a 400.
const permissionAction = z.enum(PERMISSION_ACTIONS as unknown as [string, ...string[]]);

export const updateRolePermissionsSchema = z.object({
  role: z.enum(ROLES),
  changes: z
    .array(
      z.object({
        action: permissionAction,
        granted: z.boolean(),
      }),
    )
    .min(1)
    .max(CONFIGURABLE_ACTIONS.length)
    // No duplicates, so the audit trail can say what the change did.
    .refine((changes) => new Set(changes.map((change) => change.action)).size === changes.length, {
      message: "duplicate action",
    }),
});

export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
