import type { Role } from "@/types/role";
import type {
  ConfigurableAction,
  ConfigurablePermissionMatrix,
  PermissionAction,
  PermissionMatrixPayload,
} from "@/types/permission";
import {
  CONFIGURABLE_ACTIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_ACTIONS,
  PROTECTED_ACTIONS,
} from "@/constants/permissions";
import { FIXED_ROLE, ROLES } from "@/constants/roles";

// Loose on purpose: Prisma's Role enum and the apps' Role union both satisfy `role: string`.
export interface PermissionSubject {
  role: string;
}

const PROTECTED_SET: ReadonlySet<string> = new Set(PROTECTED_ACTIONS);

export function isProtectedAction(action: string): boolean {
  return PROTECTED_SET.has(action);
}

export function isConfigurableAction(action: string): action is ConfigurableAction {
  return !PROTECTED_SET.has(action) && (CONFIGURABLE_ACTIONS as readonly string[]).includes(action);
}

// can() stays synchronous: the stored config lives here, loaded by the API and pushed in by the apps; null means the shipped defaults.
let storedConfig: ConfigurablePermissionMatrix | null = null;

/** Replace the stored grants (null resets to defaults); PROTECTED entries are dropped here, the last line before can(). */
export function setConfigurablePermissions(matrix: ConfigurablePermissionMatrix | null): void {
  storedConfig = matrix ? sanitizeConfigurableMatrix(matrix) : null;
}

/** What is currently in force, for whoever needs to show it or diff it. */
export function getConfigurablePermissions(): ConfigurablePermissionMatrix | null {
  return storedConfig;
}

/** The one role never configurable: an Admin holds everything always (rule 5), which is what prevents a lockout. */
export function isFixedRole(role: string): boolean {
  return role === FIXED_ROLE;
}

/** Drops non-configurable actions, unknown roles and the ADMIN row. */
export function sanitizeConfigurableMatrix(matrix: ConfigurablePermissionMatrix): ConfigurablePermissionMatrix {
  const clean: ConfigurablePermissionMatrix = {};
  for (const role of ROLES) {
    if (isFixedRole(role)) {
      continue;
    }
    const grants = matrix[role];
    if (!grants) {
      continue;
    }
    const kept: Partial<Record<ConfigurableAction, boolean>> = {};
    for (const [action, granted] of Object.entries(grants)) {
      if (typeof granted === "boolean" && isConfigurableAction(action)) {
        kept[action] = granted;
      }
    }
    clean[role] = kept;
  }
  return clean;
}

function holdsByDefault(role: string, action: PermissionAction): boolean {
  const defaults = DEFAULT_ROLE_PERMISSIONS[role as Role] as readonly PermissionAction[] | undefined;
  return defaults ? defaults.includes(action) : false;
}

/** The single authorization check (rule 5): ADMIN and PROTECTED from the defaults only, the rest from stored config with defaults as fallback. */
export function can(user: PermissionSubject | null | undefined, action: PermissionAction): boolean {
  if (!user) {
    return false;
  }
  if (isFixedRole(user.role) || isProtectedAction(action)) {
    return holdsByDefault(user.role, action);
  }

  const stored = storedConfig?.[user.role as Role]?.[action as ConfigurableAction];
  return stored ?? holdsByDefault(user.role, action);
}

/** Every action a role holds now, for the permissions screen and so the apps' can() matches the backend. */
export function effectiveActionsFor(role: Role): PermissionAction[] {
  // In PERMISSION_ACTIONS order, so payloads, screens and audit entries agree.
  return PERMISSION_ACTIONS.filter((action) => can({ role }, action));
}

/** The whole picture, as the API serves it. */
export function buildPermissionMatrixPayload(): PermissionMatrixPayload {
  const roles = {} as PermissionMatrixPayload["roles"];
  for (const role of ROLES) {
    roles[role] = effectiveActionsFor(role);
  }
  return { roles, protectedActions: PROTECTED_ACTIONS, configurableActions: CONFIGURABLE_ACTIONS };
}

/** Reads only configurableActions from an API payload; the protected half is for the screen and never trusted by the resolver. */
export function configurableMatrixFromPayload(payload: PermissionMatrixPayload): ConfigurablePermissionMatrix {
  const matrix: ConfigurablePermissionMatrix = {};
  for (const role of ROLES) {
    const held = new Set(payload.roles?.[role] ?? []);
    const grants: Partial<Record<ConfigurableAction, boolean>> = {};
    for (const action of payload.configurableActions ?? []) {
      grants[action] = held.has(action);
    }
    matrix[role] = grants;
  }
  return matrix;
}

/** Convenience for the frontends' PermissionsProvider: parse and publish in one step. */
export function applyPermissionMatrixPayload(payload: PermissionMatrixPayload): void {
  setConfigurablePermissions(configurableMatrixFromPayload(payload));
}
