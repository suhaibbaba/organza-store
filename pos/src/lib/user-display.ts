"use client";

import { useTranslations } from "next-intl";
import type { Role } from "@organza/shared/types/role";
import {
  cleanUserName,
  userDisplayName,
  userInitial,
  type DisplayableUser,
} from "@organza/shared/lib/userDisplay";

// The last step of naming a person on screen: the shared rule
// (shared/src/lib/userDisplay.ts) resolves a name or an email, and this adds
// the one fallback that has to be TRANSLATED — their role (CLAUDE.md rule 12).
//
// A hook rather than a plain function because of that t(), and one per app
// because the two keep their own message files. Deliberately the same shape
// as the admin's, so a person is named identically in both.

type NamedUser = DisplayableUser & { role?: Role | null };

/**
 * "Suhaib", or "suhaib" from the address, or "Employee" — in that order, and
 * never an internal id.
 *
 * Returns a pair rather than a string: the avatar's letter has to come from
 * the same source as the name, or a circle reading "M" ends up beside a name
 * reading "Employee".
 */
export function useUserDisplay() {
  // The POS has no staff screen of its own, so the three role words live in
  // `common` — the only place this app needs them.
  const tRole = useTranslations("common.role");

  return (user: NamedUser | null | undefined) => {
    const roleLabel = user?.role ? tRole(user.role) : "";
    const name = userDisplayName(user) ?? roleLabel;
    return { name, initial: userInitial(user, roleLabel) };
  };
}

/**
 * The same rule for somebody who is only a name on a record — an order's
 * "taken by", a change request's "asked by". Those carry no email and no
 * role, so there is nothing to fall back to but the caller's own already
 * translated word for "a member of staff".
 *
 * Not merged into the hook above: that one names the person USING the app,
 * this one names a person MENTIONED by a record, and the two have different
 * things left when the name is unusable.
 */
export function useActorName() {
  return (actor: { name?: string | null } | null | undefined, unknownLabel: string) =>
    cleanUserName(actor?.name) ?? unknownLabel;
}
