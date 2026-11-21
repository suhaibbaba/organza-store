// How a person is named on screen: their name, else their email's local part, else the caller's role; never an internal id.

/** A cuid-like token: ASCII lower-case letters and digits mixed, 12+ characters, narrow because it deletes typed text. */
const ID_LIKE = /^(?=[a-z0-9]*[a-z])(?=[a-z0-9]*\d)[a-z0-9]{12,}$/;

export function looksLikeInternalId(token: string): boolean {
  return ID_LIKE.test(token);
}

/** The stored name without id-shaped words (test runs left some behind); null when nothing readable remains. */
export function cleanUserName(name: string | null | undefined): string | null {
  if (!name) {
    return null;
  }
  const kept = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0 && !looksLikeInternalId(word));
  const cleaned = kept.join(" ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** The part of an email before the @, tidied into something readable. */
export function emailLocalPart(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }
  const local = email.split("@")[0]?.trim();
  if (!local) {
    return null;
  }
  // Separators in an email's local part are not part of the name.
  const spaced = local.replace(/[._-]+/g, " ").trim();
  return spaced.length > 0 ? spaced : null;
}

export interface DisplayableUser {
  name?: string | null;
  email?: string | null;
}

/** What to call this person, or null so each app adds the translated role (rule 12; see resolveUserName). */
export function userDisplayName(user: DisplayableUser | null | undefined): string | null {
  if (!user) {
    return null;
  }
  return cleanUserName(user.name) ?? emailLocalPart(user.email);
}

/** The avatar letter, from what is displayed; `fallback` is the caller's translated role. */
export function userInitial(user: DisplayableUser | null | undefined, fallback?: string): string {
  const source = userDisplayName(user) ?? fallback ?? "";
  const first = source.trim().charAt(0);
  return first ? first.toLocaleUpperCase() : "?";
}
