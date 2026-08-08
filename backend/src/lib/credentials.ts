import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { AUTH_PROVIDER_CREDENTIAL } from "@/constants";

// Writing a password, in the one place that knows where Better Auth keeps it.
//
// Better Auth stores the hash on the credential `Account` row, not on `User`
// (CLAUDE.md rule 17), and hashes it with its own algorithm — so this uses
// Better Auth's own hasher rather than reaching for bcrypt, and a password
// set here is indistinguishable from one set at sign-up.

/** Creates the credential account if the user has none (an account created with no password). */
export async function setUserPassword(userId: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  const account = await prisma.account.findFirst({
    where: { userId, providerId: AUTH_PROVIDER_CREDENTIAL },
  });

  if (account) {
    await prisma.account.update({ where: { id: account.id }, data: { password: passwordHash } });
    return;
  }

  await prisma.account.create({
    data: { userId, providerId: AUTH_PROVIDER_CREDENTIAL, accountId: userId, password: passwordHash },
  });
}

/**
 * Signs every device out. Called whenever a password is set from an emailed
 * link: if the reason for the reset was that somebody else had the old
 * password, leaving their session alive would make the reset decorative.
 */
export async function revokeAllSessions(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { userId } });
  return result.count;
}
