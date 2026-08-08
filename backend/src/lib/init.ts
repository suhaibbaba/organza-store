import type { InitAccountDetails, InitAccountResult, InitDependencies } from "@/types/init";

// The go-live command's actual rule, with nothing around it: create these
// accounts with no password and email each of them a link — but only into a
// database that has no users in it at all.
//
// Kept out of scripts/init.ts so the refusal is a thing that can be proven
// rather than a thing somebody remembered to write.

/** Thrown when the database is already in use. Its message goes straight to the terminal. */
export class InitRefusedError extends Error {
  readonly existingUsers: number;

  constructor(existingUsers: number) {
    super(
      `This database already has ${existingUsers} user account(s).\n` +
        "`init` only ever populates an EMPTY database. Adding one more member of staff " +
        "is the admin's Users screen; starting over is `npm run db:reset` followed by " +
        "migrate, bootstrap, and this."
    );
    this.name = "InitRefusedError";
    this.existingUsers = existingUsers;
  }
}

/**
 * Creates the shop's staff accounts, in order, each with no password and each
 * emailed a set-password link.
 *
 * Refuses outright if ANY user already exists. There is deliberately no
 * partial mode and no "top up the ones that are missing": a database with a
 * user in it is a database somebody is already using, and half-running this
 * against it would be worse than not running it at all.
 */
export async function createInitialStaff(
  accounts: InitAccountDetails[],
  deps: InitDependencies
): Promise<InitAccountResult[]> {
  const existing = await deps.countUsers();
  // Checked before anything is written, so a refusal leaves nothing behind.
  if (existing > 0) throw new InitRefusedError(existing);

  const results: InitAccountResult[] = [];
  for (const account of accounts) {
    const user = await deps.createAccount(account);
    const invite = await deps.sendInvite(user);
    results.push({ email: account.email, role: account.role, expiresAt: invite.expiresAt });
  }
  return results;
}
