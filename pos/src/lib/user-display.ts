"use client";

import { useTranslations } from "next-intl";
import type { Role } from "@store/shared/types/role";
import { cleanUserName, userDisplayName, userInitial, type DisplayableUser } from "@store/shared/lib/userDisplay";

// Adds the translated role fallback (rule 12) to the shared name rule, hence a hook.

type NamedUser = DisplayableUser & { role?: Role | null };

// Name, else the email's local part, else the role, never an id; the avatar letter comes from the same source.
export function useUserDisplay() {
  // The POS has no staff screen, so the role words live in `common`.
  const tRole = useTranslations("common.role");

  return (user: NamedUser | null | undefined) => {
    const roleLabel = user?.role ? tRole(user.role) : "";
    const name = userDisplayName(user) ?? roleLabel;
    return { name, initial: userInitial(user, roleLabel) };
  };
}

// For a name on a record (taken by, asked by), which has no email or role to fall back to.
export function useActorName() {
  return (actor: { name?: string | null } | null | undefined, unknownLabel: string) =>
    cleanUserName(actor?.name) ?? unknownLabel;
}
