import type { PermissionAction, Role } from "@organza/shared/types";

/** What `GET /api/permissions` answers with. */
export interface PermissionMatrixResponse {
  roles: Record<Role, PermissionAction[]>;
  protectedActions: PermissionAction[];
  configurableActions: PermissionAction[];
}

/** One entry of a `PATCH /api/permissions` body. */
export interface PermissionChangeRequestBody {
  action: string;
  granted: boolean;
}
