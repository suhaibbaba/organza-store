import type { Role } from './roles.js';

const ALL: Role[] = ['ADMIN', 'MANAGER', 'EMPLOYEE'];
const MANAGERS: Role[] = ['ADMIN', 'MANAGER'];
const ADMIN: Role[] = ['ADMIN'];

/**
 * Fixed role defaults (decision H3: no permission editor). Every API route declares one of
 * these keys with @Can(); the web app hides what the signed-in role cannot do with the same
 * table. ADMIN is allowed everything regardless of this list.
 */
export const CAPABILITIES = {
  // Own account (every signed-in user)
  'account.self': ALL,
  // Admin
  'staff.view': ADMIN,
  'staff.manage': ADMIN,
  'settings.view': ALL,
  'settings.manage': ADMIN,
  'audit.view': ADMIN,
  'activity.view': ALL,
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function roleCan(role: Role, capability: Capability): boolean {
  if (role === 'ADMIN') return true;
  return (CAPABILITIES[capability] as readonly Role[]).includes(role);
}

export function capabilitiesFor(role: Role): Capability[] {
  return (Object.keys(CAPABILITIES) as Capability[]).filter((c) => roleCan(role, c));
}

// Re-exported so callers can build their own lists without importing roles.
export const ROLE_GROUPS = { ALL, MANAGERS, ADMIN } as const;
