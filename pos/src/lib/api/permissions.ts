import type { PermissionMatrixPayload } from "@store/shared/types/permission";
import { apiFetch } from "@/lib/api/client";

// Read-only here: the till shows the rules, the admin edits them.
export async function fetchPermissionMatrix(): Promise<PermissionMatrixPayload> {
  const { data } = await apiFetch<PermissionMatrixPayload>("/api/permissions");
  return data;
}
