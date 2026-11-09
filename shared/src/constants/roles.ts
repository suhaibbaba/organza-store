// CLAUDE.md rule 5: three fixed roles, gated on the backend.
export const ROLES = ["ADMIN", "MANAGER", "EMPLOYEE"] as const;

// The role whose permissions are never configurable (spec.md "Editable role
// permissions"): an Admin holds every action, always, so no edit to the
// permissions table can leave the shop without somebody able to undo it.
export const FIXED_ROLE = "ADMIN" satisfies (typeof ROLES)[number];
