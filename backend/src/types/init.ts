import type { Role } from "@shared/types/role";

/** One account the go-live command is about to create, once its details are known. */
export interface InitAccountDetails {
  email: string;
  name: string;
  phone: string;
  role: Role;
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
