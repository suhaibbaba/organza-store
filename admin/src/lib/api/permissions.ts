import type { PermissionMatrixPayload } from "@organza/shared/types/permission";
import type { Role } from "@organza/shared/types/role";
import { apiFetch } from "@/lib/api/client";

/** What the API says each role may do right now (spec.md "Editable role permissions"). */
export async function fetchPermissionMatrix(): Promise<PermissionMatrixPayload> {
  const { data } = await apiFetch<PermissionMatrixPayload>("/api/permissions");
  return data;
}

export interface RolePermissionChange {
  action: string;
  granted: boolean;
}

/**
 * One checkbox, one request. The response is the whole matrix again, so the
 * screen never has to guess what the change did — including the case where it
 * did nothing because somebody else got there first.
 */
export async function updateRolePermissions(input: {
  role: Role;
  changes: RolePermissionChange[];
}): Promise<PermissionMatrixPayload> {
  const { data } = await apiFetch<PermissionMatrixPayload>("/api/permissions", {
    method: "PATCH",
    body: input,
  });
  return data;
}
