import type { PermissionMatrixPayload } from "@organza/shared/types/permission";
import { apiFetch } from "@/lib/api/client";

/**
 * What the API says each role may do right now (spec.md "Editable role
 * permissions"). Read-only here: the till shows the rules, the admin edits
 * them.
 */
export async function fetchPermissionMatrix(): Promise<PermissionMatrixPayload> {
  const { data } = await apiFetch<PermissionMatrixPayload>("/api/permissions");
  return data;
}
