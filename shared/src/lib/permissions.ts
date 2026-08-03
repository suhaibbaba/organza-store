import type { Role } from "@/types/role";
import type { PermissionAction } from "@/types/permission";
import { ROLE_PERMISSIONS } from "@/constants/permissions";

// Loose on purpose: backend passes a Prisma `Role` enum member (structurally
// a string), admin/pos pass the plain `Role` string union — both satisfy
// `role: string`, so callers never need to cast.
export interface PermissionSubject {
  role: string;
}

// Single authorization check (CLAUDE.md rule 5). Backend calls this as the
// real gate (403 when false); admin/pos call it only to decide what to show.
export function can(user: PermissionSubject | null | undefined, action: PermissionAction): boolean {
  if (!user) return false;
  const actions = ROLE_PERMISSIONS[user.role as Role] as readonly PermissionAction[] | undefined;
  return actions ? actions.includes(action) : false;
}
