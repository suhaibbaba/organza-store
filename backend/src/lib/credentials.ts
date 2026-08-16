import type { Role, User } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AUTH_PROVIDER_CREDENTIAL } from "@/constants";

// Writing a password, in the one place that knows where Better Auth keeps it.
//
// Everything here goes through Better Auth's OWN context (`auth.$context`)
// rather than through Prisma, and that is the whole point of the file. A
// password is only worth anything if the code that CHECKS it agrees with the
// code that WROTE it, and sign-in checks it with `ctx.password.verify`
// against every credential `Account` row it can find. Three ways of
// disagreeing with that were possible while this wrote rows itself:
//
//   * hashing — reaching for the exported hasher (or, worse, bcrypt) writes a
//     digest in whatever format that function happens to use today. Better
//     Auth verifies with whatever `ctx.password.verify` is, which follows the
//     config. `ctx.password.hash` is that same pair's other half, so the two
//     cannot drift apart across an upgrade or a config change;
//   * where it is written — the hash lives on the credential Account row, not
//     on User (CLAUDE.md rule 17). `internalAdapter` is what Better Auth
//     itself writes through, so "somewhere Better Auth doesn't consult" stops
//     being a thing this file can express;
//   * WHICH row — sign-in takes the FIRST credential row it is handed, in the
//     database's order, while a hand-written `findFirst` + `update` picks its
//     own. If a user ever ends up with two credential rows, those two need
//     not be the same row: the password is set, and sign-in reads the other
//     one and says it is wrong. `updatePassword` updates them ALL, so no
//     stale row can shadow the new password.

/**
 * Creates a staff account — the ONLY way one comes into existence.
 *
 * This used to be `auth.api.signUpEmail`, which was the same endpoint the
 * open internet could reach: the public door and the Admin's door were one
 * door, so closing the first would have closed the second. Now sign-up is
 * disabled outright (lib/auth.ts) and this writes through Better Auth's own
 * internal adapter instead — the same adapter its sign-up handler uses, so
 * the row is the row sign-in expects, field for field.
 *
 * The account is created with NO credential row at all when no password is
 * given (CLAUDE.md rule 17: nobody is handed a password). That is a change
 * for the better on top of the security fix — the old path had to invent a
 * throwaway password, hash it, store it and then null it out, which meant a
 * working secret existed in the database for the width of two writes. Now
 * none is ever minted: `setUserPassword` links the credential row when the
 * person chooses their own from the emailed link.
 *
 * The email is lower-cased because that is what Better Auth's sign-in does
 * before it looks an account up (`email.toLowerCase()`); storing it any other
 * way creates an account that cannot be signed in to.
 */
export async function createStaffUser(input: {
  email: string;
  name: string;
  role: Role;
  phone: string;
  whatsapp: string | null;
  idNumber: string | null;
}): Promise<User> {
  const ctx = await auth.$context;

  const created = await ctx.internalAdapter.createUser({
    email: normalizeEmail(input.email),
    name: input.name,
    emailVerified: false,
    role: input.role,
    phone: input.phone,
    whatsapp: input.whatsapp,
    idNumber: input.idNumber,
    isActive: true,
  });

  if (!created) throw new Error("Better Auth's internal adapter did not return the created user");
  return created as User;
}

/** The one spelling of an address the whole system agrees on — see above. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Writes the password, creating the credential account if the user has none. */
export async function setUserPassword(userId: string, password: string): Promise<void> {
  const ctx = await auth.$context;
  const passwordHash = await ctx.password.hash(password);

  const accounts = await ctx.internalAdapter.findAccounts(userId);
  const hasCredentialAccount = accounts.some((account) => account.providerId === AUTH_PROVIDER_CREDENTIAL);

  if (hasCredentialAccount) {
    // Every credential row for this user, not just one of them.
    await ctx.internalAdapter.updatePassword(userId, passwordHash);
    return;
  }

  // An account created with no password at all still has its credential row
  // (see routes/users.ts), so this is the belt-and-braces path — but it is
  // Better Auth's own `linkAccount`, so the row it creates is the row sign-in
  // expects, field for field.
  await ctx.internalAdapter.linkAccount({
    userId,
    providerId: AUTH_PROVIDER_CREDENTIAL,
    accountId: userId,
    password: passwordHash,
  });
}

/**
 * Signs every device out. Called whenever a password is set from an emailed
 * link: if the reason for the reset was that somebody else had the old
 * password, leaving their session alive would make the reset decorative.
 *
 * Through Better Auth as well, so a session cache (or a secondary store, if
 * one is ever configured) is cleared with the rows rather than left holding a
 * session the database no longer has.
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  const ctx = await auth.$context;
  await ctx.internalAdapter.deleteUserSessions(userId);
}

/**
 * Has this person finished setting up — i.e. is there a password on the
 * account at all?
 *
 * A staff account is created with none (CLAUDE.md rule 17), so "no password"
 * is the normal state of somebody who has been invited and has not opened
 * their mail yet. It is a READ, so it goes straight to the database: what it
 * asks about is exactly what sign-in looks at.
 */
export async function hasUsablePassword(userId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: AUTH_PROVIDER_CREDENTIAL, NOT: { password: null } },
    select: { id: true },
  });
  return account !== null;
}

/** The same question for a whole page of staff, in one query. */
export async function usersWithPassword(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const accounts = await prisma.account.findMany({
    where: { userId: { in: userIds }, providerId: AUTH_PROVIDER_CREDENTIAL, NOT: { password: null } },
    select: { userId: true },
  });
  return new Set(accounts.map((account) => account.userId));
}
