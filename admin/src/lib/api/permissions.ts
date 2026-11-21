import type { PermissionMatrixPayload } from "@store/shared/types/permission";
import type { Role } from "@store/shared/types/role";
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

// The response is the whole matrix, including when someone else got there first.
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
