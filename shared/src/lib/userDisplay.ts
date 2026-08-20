// ============================================================================
//  How a person is named on screen.
//
//  One rule for both apps, because "who did this" appears in a dozen places —
//  the account button, an order's "taken by", a change request's "asked by",
//  the staff list — and they must not disagree about what to show when the
//  stored name is unusable.
//
//  The rule, in order:
//    1. Their name, if it is a name.
//    2. The local part of their email ("suhaib" from suhaib@…), which is
//       nearly always the person's own word for themselves.
//    3. Nothing — and the caller falls back to their ROLE, which is the last
//       thing that is still true and still means something to a colleague.
//
//  What it must NEVER produce is an internal id. An id is meaningless to
//  whoever is reading it, it is unbounded in length so it stretches whatever
//  is drawn around it, and a bar that reads "Admin mt0grbxoqx7nbf" looks
//  broken rather than informative.
// ============================================================================

/**
 * A cuid, a nanoid, a test nonce: a long run of lower-case letters and digits
 * with no word shape to it.
 *
 * Deliberately narrow, because this is used to DELETE text somebody may have
 * typed on purpose. All four conditions have to hold at once:
 *   - ASCII only, so no Arabic or Hebrew name can ever match;
 *   - at least 12 characters, longer than any ordinary word;
 *   - lower case throughout, so "Muhammad" and "AlQuds2000" are safe;
 *   - letters AND digits mixed, which is what a name never is.
 */
const ID_LIKE = /^(?=[a-z0-9]*[a-z])(?=[a-z0-9]*\d)[a-z0-9]{12,}$/;

export function looksLikeInternalId(token: string): boolean {
  return ID_LIKE.test(token);
}

/**
 * The stored name with any id-shaped words taken out of it.
 *
 * Returns null when nothing readable is left. The stripping exists because
 * ids reach the name field for real: an API test used to rename the seeded
 * Admin to `Admin <nonce>` and never put it back, and every sandbox that has
 * ever run the suite carries the result. Rather than teach every screen to
 * cope with that, it is cleaned once, here.
 */
export function cleanUserName(name: string | null | undefined): string | null {
  if (!name) return null;
  const kept = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0 && !looksLikeInternalId(word));
  const cleaned = kept.join(" ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** The part of an email before the @, tidied into something readable. */
export function emailLocalPart(email: string | null | undefined): string | null {
  if (!email) return null;
  const local = email.split("@")[0]?.trim();
  if (!local) return null;
  // "suhaib.baba" and "suhaib_baba" are one person's name written with the
  // punctuation an address forces on it — the separators are not part of it.
  const spaced = local.replace(/[._-]+/g, " ").trim();
  return spaced.length > 0 ? spaced : null;
}

export interface DisplayableUser {
  name?: string | null;
  email?: string | null;
}

/**
 * What to call this person, or null when only their role is left.
 *
 * Null rather than a built-in default, because the last fallback is a
 * TRANSLATED word (CLAUDE.md rule 12) and this file has no `t()`. Each app
 * wraps it with the role label — see `resolveUserName` in either app's
 * lib/user-display.ts.
 */
export function userDisplayName(user: DisplayableUser | null | undefined): string | null {
  if (!user) return null;
  return cleanUserName(user.name) ?? emailLocalPart(user.email);
}

/**
 * The single letter an avatar shows. Taken from whatever is actually being
 * displayed, so the circle and the name beside it can never disagree.
 *
 * `fallback` is the caller's already-translated last resort (the role), so a
 * user with no usable name still gets a letter rather than a "?".
 */
export function userInitial(user: DisplayableUser | null | undefined, fallback?: string): string {
  const source = userDisplayName(user) ?? fallback ?? "";
  const first = source.trim().charAt(0);
  return first ? first.toLocaleUpperCase() : "?";
}
