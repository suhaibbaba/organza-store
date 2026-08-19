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
import { ROLES } from "@/constants/roles";

// Loose on purpose: backend passes a Prisma `Role` enum member (structurally
// a string), admin/pos pass the plain `Role` string union — both satisfy
// `role: string`, so callers never need to cast.
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

// ===========================================================================
//  The stored half of the rules
// ===========================================================================
//
// `can()` is called dozens of times per request and has to stay synchronous —
// every one of its ~125 call sites is an `if`, not an `await`. So the stored
// configuration lives here, in one module-level value, and whoever owns the
// process is responsible for putting it there and keeping it current:
//
//   - the API loads it from the database on boot and refreshes it when it
//     changes (backend/src/lib/permissionConfig.ts);
//   - admin and pos fetch it once with the session and push it in
//     (their PermissionsProvider).
//
// Until somebody does, it is null and every answer comes from
// DEFAULT_ROLE_PERMISSIONS — the behaviour this system shipped with. That is
// the important property of this default: a process that has not loaded the
// config yet, or cannot reach the database to load it, is not a process where
// everybody suddenly holds everything, nor one where nobody can do anything.
// It is a process running the rules as written.
let storedConfig: ConfigurablePermissionMatrix | null = null;

/**
 * Replace the stored configurable grants. Pass null to go back to the
 * shipped defaults (which is what tests do between cases).
 *
 * PROTECTED entries in the incoming matrix are dropped rather than trusted:
 * this is the last line before `can()`, and it must not matter whether the
 * caller upstream remembered to filter. Nothing that arrives here can widen
 * or narrow a protected action.
 */
export function setConfigurablePermissions(matrix: ConfigurablePermissionMatrix | null): void {
  storedConfig = matrix ? sanitizeConfigurableMatrix(matrix) : null;
}

/** What is currently in force, for whoever needs to show it or diff it. */
export function getConfigurablePermissions(): ConfigurablePermissionMatrix | null {
  return storedConfig;
}

/** Drops anything that is not a configurable action, and any unknown role. */
export function sanitizeConfigurableMatrix(matrix: ConfigurablePermissionMatrix): ConfigurablePermissionMatrix {
  const clean: ConfigurablePermissionMatrix = {};
  for (const role of ROLES) {
    const grants = matrix[role];
    if (!grants) continue;
    const kept: Partial<Record<ConfigurableAction, boolean>> = {};
    for (const [action, granted] of Object.entries(grants)) {
      if (typeof granted === "boolean" && isConfigurableAction(action)) kept[action] = granted;
    }
    clean[role] = kept;
  }
  return clean;
}

function holdsByDefault(role: string, action: PermissionAction): boolean {
  const defaults = DEFAULT_ROLE_PERMISSIONS[role as Role] as readonly PermissionAction[] | undefined;
  return defaults ? defaults.includes(action) : false;
}

/**
 * Single authorization check (CLAUDE.md rule 5). Backend calls this as the
 * real gate (403 when false); admin/pos call it only to decide what to show.
 *
 * Two sources, one answer:
 *   - a PROTECTED action is answered from DEFAULT_ROLE_PERMISSIONS and
 *     nothing else, so no stored row, no API call and no hand-edited database
 *     can move it;
 *   - a CONFIGURABLE action is answered from the stored config, falling back
 *     to the same defaults wherever the config has nothing to say.
 */
export function can(user: PermissionSubject | null | undefined, action: PermissionAction): boolean {
  if (!user) return false;
  if (isProtectedAction(action)) return holdsByDefault(user.role, action);

  const stored = storedConfig?.[user.role as Role]?.[action as ConfigurableAction];
  return stored ?? holdsByDefault(user.role, action);
}

/**
 * Every action a role holds right now — what the permissions screen renders,
 * and what the API hands the frontends so their own `can()` agrees with the
 * backend's.
 */
export function effectiveActionsFor(role: Role): PermissionAction[] {
  // Walked in the order PERMISSION_ACTIONS declares, so every payload, screen
  // and audit entry lists actions the same way round.
  return PERMISSION_ACTIONS.filter((action) => can({ role }, action));
}

/** The whole picture, as the API serves it. */
export function buildPermissionMatrixPayload(): PermissionMatrixPayload {
  const roles = {} as PermissionMatrixPayload["roles"];
  for (const role of ROLES) roles[role] = effectiveActionsFor(role);
  return { roles, protectedActions: PROTECTED_ACTIONS, configurableActions: CONFIGURABLE_ACTIONS };
}

/**
 * ...and the way back. Reads the configurable half out of a payload the API
 * served, so a browser's `can()` answers exactly as the server's does.
 *
 * Only `configurableActions` is read. The protected half of the payload is
 * information for the SCREEN — which rows to draw as locked — and is
 * deliberately not fed back into the resolver, which answers those from the
 * shipped table and must not start believing a response instead.
 */
export function configurableMatrixFromPayload(payload: PermissionMatrixPayload): ConfigurablePermissionMatrix {
  const matrix: ConfigurablePermissionMatrix = {};
  for (const role of ROLES) {
    const held = new Set(payload.roles?.[role] ?? []);
    const grants: Partial<Record<ConfigurableAction, boolean>> = {};
    for (const action of payload.configurableActions ?? []) grants[action] = held.has(action);
    matrix[role] = grants;
  }
  return matrix;
}

/** Convenience for the frontends' PermissionsProvider: parse and publish in one step. */
export function applyPermissionMatrixPayload(payload: PermissionMatrixPayload): void {
  setConfigurablePermissions(configurableMatrixFromPayload(payload));
}
