"use client";

import { useTranslations } from "next-intl";
import type { Role } from "@store/shared/types/role";
import { cleanUserName, userDisplayName, userInitial, type DisplayableUser } from "@store/shared/lib/userDisplay";

// Adds the one fallback that must be translated, the role (rule 12); the rest is shared/src/lib/userDisplay.ts.

type NamedUser = DisplayableUser & { role?: Role | null };

// Name, else the address's local part, else the role, never an id; the initial comes from the same source.
export function useUserDisplay() {
  // Reused from the users screen so the menu and the staff list never name a role differently.
  const tRole = useTranslations("users.role");

  return (user: NamedUser | null | undefined) => {
    const roleLabel = user?.role ? tRole(user.role) : "";
    const name = userDisplayName(user) ?? roleLabel;
    return { name, initial: userInitial(user, roleLabel), roleLabel };
  };
}

// For a person named on a record (no email, no role): falls back to the caller's own word for staff.
export function useActorName() {
  return (actor: { name?: string | null } | null | undefined, unknownLabel: string) =>
    cleanUserName(actor?.name) ?? unknownLabel;
}
