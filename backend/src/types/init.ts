import type { Role } from "@shared/types/role";

/** One account the go-live command is about to create, once its details are known. */
export interface InitAccountDetails {
  email: string;
  name: string;
  phone: string;
  role: Role;
}

/**
 * One thing wrong with the roster file, located precisely enough to fix
 * without guessing: which entry, which field, and what is wrong with it.
 *
 * `entry` is how a human finds the row — its email when there is one to read,
 * and its position when there is not.
 */
export interface StaffFileProblem {
  entry: string;
  field?: string;
  message: string;
}

/** Overrides applied on top of the file, keyed by lower-cased email. */
export interface StaffOverrides {
  names?: Map<string, string>;
  phones?: Map<string, string>;
}

/** What was created, per account. Printed by the CLI. */
export interface InitAccountResult {
  email: string;
  role: Role;
  /** When the emailed link stops working. */
  expiresAt: Date;
}

/**
 * Everything `createInitialStaff` needs from the world. Injected so the
 * refusal and the ordering can be proven without a database, a mail provider
 * or a terminal (see tests/unit/init.test.ts).
 */
export interface InitDependencies {
  countUsers(): Promise<number>;
  /** Creates the account with NO usable password. */
  createAccount(details: InitAccountDetails): Promise<{ id: string; name: string; email: string }>;
  /** Mints a single-use link and emails it. */
  sendInvite(user: { id: string; name: string; email: string }): Promise<{ expiresAt: Date }>;
}
