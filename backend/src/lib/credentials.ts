import type { Role, User } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AUTH_PROVIDER_CREDENTIAL } from "@/constants";

// Passwords are written only through Better Auth's own context, so what sign-in verifies can never drift from what was stored (rule 17).

// The only way a staff account comes into existence; with no password it gets no credential and the owner sets one from the emailed link.
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

  if (!created) {
    throw new Error("Better Auth's internal adapter did not return the created user");
  }
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

  // Belt and braces: Better Auth's own linkAccount, so the row is the one sign-in expects.
  await ctx.internalAdapter.linkAccount({
    userId,
    providerId: AUTH_PROVIDER_CREDENTIAL,
    accountId: userId,
    password: passwordHash,
  });
}

// Signs every device out, through Better Auth so any session cache is cleared too.
export async function revokeAllSessions(userId: string): Promise<void> {
  const ctx = await auth.$context;
  await ctx.internalAdapter.deleteUserSessions(userId);
  // A passcode would reopen what was just closed, so every tablet forgets this person too.
  await prisma.posDeviceMember.deleteMany({ where: { userId } });
}

// Whether the account has a password at all: no password is the normal state of an invited, not-yet-set-up person.
export async function hasUsablePassword(userId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: AUTH_PROVIDER_CREDENTIAL, NOT: { password: null } },
    select: { id: true },
  });
  return account !== null;
}

/** The same question for a whole page of staff, in one query. */
export async function usersWithPassword(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) {
    return new Set();
  }
  const accounts = await prisma.account.findMany({
    where: { userId: { in: userIds }, providerId: AUTH_PROVIDER_CREDENTIAL, NOT: { password: null } },
    select: { userId: true },
  });
  return new Set(accounts.map((account) => account.userId));
}

// Through Better Auth's own verifier, so it checks exactly what sign-in checks.
export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
  const ctx = await auth.$context;
  const accounts = await ctx.internalAdapter.findAccounts(userId);
  const hash = accounts.find((account) => account.providerId === AUTH_PROVIDER_CREDENTIAL)?.password;
  if (!hash) {
    return false;
  }
  return ctx.password.verify({ hash, password });
}

export async function revokeOtherSessions(userId: string, keepSessionId: string | undefined): Promise<void> {
  const ctx = await auth.$context;
  const sessions = await prisma.session.findMany({
    where: { userId, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) },
    select: { token: true },
  });
  if (sessions.length > 0) {
    await ctx.internalAdapter.deleteSessions(sessions.map((session) => session.token));
  }
}
