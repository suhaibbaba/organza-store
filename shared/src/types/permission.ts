import type { PERMISSION_ACTIONS, PROTECTED_ACTIONS } from "@/constants/permissions";
import type { Role } from "@/types/role";

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/** An action the shop can never switch off — see PROTECTED_ACTIONS. */
export type ProtectedAction = (typeof PROTECTED_ACTIONS)[number];

/** An action the admin's Permissions screen may grant or revoke per role. */
export type ConfigurableAction = Exclude<PermissionAction, ProtectedAction>;

/**
 * The stored half of the rules: for each role, an explicit on/off for each
 * CONFIGURABLE action. PROTECTED actions never appear here — `can()` would
 * ignore them, and the API refuses to write them (see
 * backend/src/routes/permissions.ts).
 *
 * A map of on/off rather than a list of what is held, and both halves are
 * `Partial` on purpose: an entry that is MISSING means "nobody has decided",
 * and falls back to DEFAULT_ROLE_PERMISSIONS. A list could not say that — an
 * action absent from it would read as "revoked", so an action added in a
 * later release would arrive switched off on every database bootstrapped
 * before it existed, silently, for every role. Missing means "as shipped".
 */
export type ConfigurablePermissionMatrix = Partial<Record<Role, Partial<Record<ConfigurableAction, boolean>>>>;

/**
 * What `GET /api/permissions` answers with: the EFFECTIVE actions each role
 * holds right now (protected + stored configurable), plus the split itself so
 * a screen can render the locked rows without hard-coding the list a second
 * time.
 */
export interface PermissionMatrixPayload {
  roles: Record<Role, readonly PermissionAction[]>;
  protectedActions: readonly ProtectedAction[];
  configurableActions: readonly ConfigurableAction[];
}

/** One checkbox flipped: a role, an action, and on or off. */
export interface PermissionChange {
  action: ConfigurableAction;
  granted: boolean;
}
