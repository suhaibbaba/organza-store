// Setting the permission state a test relies on, rather than assuming it.
//
// Which actions a role holds is CONFIGURABLE now (spec.md "Editable role
// permissions") and lives in the target's database, so "an Employee cannot
// create a category" stopped being a property of the code and became a
// property of the shop the suite happens to be pointed at. A suite that
// assumed the shipped defaults would pass or fail depending on a checkbox
// somebody ticked in the admin last week — which is not a test, it is a
// coincidence.
//
// So the suite SETS the baseline before it runs (see tests/setup.ts) and each
// case that depends on a grant being on or off says so out loud, through
// `withRolePermission`, which puts it back afterwards.
//
// PROTECTED actions are deliberately absent from all of this. They cannot be
// set by anybody — that is the point of them — so a test about one asserts on
// the refusal instead.
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { CONFIGURABLE_ACTIONS, DEFAULT_ROLE_PERMISSIONS } from "@organza/shared/constants/permissions";
import type { PermissionAction, Role } from "@organza/shared/types";
import type { PermissionChangeRequestBody, PermissionMatrixResponse } from "@tests/types";

/**
 * The roles the suite may set. ADMIN is not among them, and cannot be: the
 * API refuses an Admin editing their own role (PERMISSION_SELF_ROLE), which
 * is the guard that makes locking the shop out unreachable. An Admin holds
 * every action anyway, so there is nothing here to restore.
 */
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
  options: { token?: string } = {}
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

/**
 * THE BASELINE. Writes every configurable grant for the settable roles back
 * to exactly what DEFAULT_ROLE_PERMISSIONS declares.
 *
 * Called once before the suite and once after it, so a run neither inherits a
 * shop's own configuration nor leaves its own behind. It is a full write
 * rather than a diff on purpose: the point is that afterwards the state is
 * known, not merely that this run did not change it.
 */
export async function applyDefaultPermissions(): Promise<void> {
  for (const role of SETTABLE_ROLES) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[role] as readonly PermissionAction[];
    await setRolePermissions(
      role,
      CONFIGURABLE_ACTIONS.map((action) => ({ action, granted: defaults.includes(action) }))
    );
  }
}

/**
 * Run `body` with one grant forced on or off, then put it back.
 *
 * Restores in a `finally` and to the SHIPPED default rather than to whatever
 * was there a moment ago: the suite has just set that baseline, so "back" and
 * "as shipped" are the same thing, and reading the old value first would only
 * add a request that could itself fail halfway.
 */
export async function withRolePermission<T>(
  role: SettableRole,
  action: PermissionAction,
  granted: boolean,
  body: () => Promise<T>
): Promise<T> {
  await setRolePermission(role, action, granted);
  try {
    return await body();
  } finally {
    const defaults = DEFAULT_ROLE_PERMISSIONS[role] as readonly PermissionAction[];
    await setRolePermission(role, action, defaults.includes(action));
  }
}
