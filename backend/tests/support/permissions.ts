// Permissions live in the target's database, so the suite sets the baseline and each case flips a grant out loud.
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { CONFIGURABLE_ACTIONS, DEFAULT_ROLE_PERMISSIONS } from "@store/shared/constants/permissions";
import type { PermissionAction, Role } from "@store/shared/types";
import type { PermissionChangeRequestBody, PermissionMatrixResponse } from "@tests/types";

/** ADMIN is never settable: the API refuses it, and an Admin holds everything anyway. */
export const SETTABLE_ROLES = ["MANAGER", "EMPLOYEE"] as const;
export type SettableRole = (typeof SETTABLE_ROLES)[number];

export async function fetchPermissionMatrix(): Promise<PermissionMatrixResponse> {
  const session = await getSession("ADMIN");
  const result = await apiRequest<PermissionMatrixResponse>("/api/permissions", { token: session.token });
  if (!result.success || !result.data) {
    throw new Error(`Could not read the permission matrix (HTTP ${result.status}).`);
  }
  return result.data;
}

/** Applies a batch of grants to one role as the Admin. Returns the raw result so a test can assert on a refusal. */
export async function patchRolePermissions(
  role: Role | string,
  changes: PermissionChangeRequestBody[],
  options: { token?: string } = {},
) {
  const token = options.token ?? (await getSession("ADMIN")).token;
  return apiRequest<PermissionMatrixResponse>("/api/permissions", {
    method: "PATCH",
    token,
    body: { role, changes },
  });
}

/** Applies a batch and throws unless it worked — for arranging a test, where a silent failure would be a false pass. */
export async function setRolePermissions(role: SettableRole, changes: PermissionChangeRequestBody[]): Promise<void> {
  const result = await patchRolePermissions(role, changes);
  if (!result.success) {
    throw new Error(`Could not set ${role} permissions (HTTP ${result.status}, ${result.error?.code}).`);
  }
}

/** One grant on or off, as a baseline a test states rather than inherits. */
export async function setRolePermission(role: SettableRole, action: string, granted: boolean): Promise<void> {
  await setRolePermissions(role, [{ action, granted }]);
}

/** Writes the shipped defaults in full, before and after the run, so the state is known rather than assumed unchanged. */
export async function applyDefaultPermissions(): Promise<void> {
  for (const role of SETTABLE_ROLES) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[role] as readonly PermissionAction[];
    await setRolePermissions(
      role,
      CONFIGURABLE_ACTIONS.map((action) => ({ action, granted: defaults.includes(action) })),
    );
  }
}

/** Runs `body` with one grant forced, restoring the shipped default in a finally. */
export async function withRolePermission<T>(
  role: SettableRole,
  action: PermissionAction,
  granted: boolean,
  body: () => Promise<T>,
): Promise<T> {
  await setRolePermission(role, action, granted);
  try {
    return await body();
  } finally {
    const defaults = DEFAULT_ROLE_PERMISSIONS[role] as readonly PermissionAction[];
    await setRolePermission(role, action, defaults.includes(action));
  }
}
