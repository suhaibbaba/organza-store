import type { InitAccountDetails, InitAccountResult, InitDependencies } from "@/types/init";

// The go-live rule: create password-less accounts and email links, only into a database with no users at all.

/** Thrown when the database is already in use. Its message goes straight to the terminal. */
export class InitRefusedError extends Error {
  readonly existingUsers: number;

  constructor(existingUsers: number) {
    // Separate lines because it prints inside a boxed terminal banner.
    super(
      [
        `This database already has ${existingUsers} user account(s).`,
        "",
        "`init` only ever populates an EMPTY database. Adding one more member",
        "of staff is the admin's Users screen; starting over is",
        "`npm run db:reset` followed by migrate, bootstrap, and this.",
      ].join("\n"),
    );
    this.name = "InitRefusedError";
    this.existingUsers = existingUsers;
  }
}

/** Creates the staff accounts in order, password-less with an emailed link; refuses if ANY user exists — no partial mode. */
export async function createInitialStaff(
  accounts: InitAccountDetails[],
  deps: InitDependencies,
): Promise<InitAccountResult[]> {
  const existing = await deps.countUsers();
  // Checked before anything is written, so a refusal leaves nothing behind.
  if (existing > 0) {
    throw new InitRefusedError(existing);
  }

  const results: InitAccountResult[] = [];
  for (const account of accounts) {
    const user = await deps.createAccount(account);
    const invite = await deps.sendInvite(user);
    results.push({ email: account.email, role: account.role, expiresAt: invite.expiresAt });
  }
  return results;
}
