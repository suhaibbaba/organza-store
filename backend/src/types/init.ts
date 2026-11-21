import type { Role } from "@store/shared/types/role";

/** One account the go-live command is about to create, once its details are known. */
export interface InitAccountDetails {
  email: string;
  name: string;
  phone: string;
  role: Role;
}

/** One roster problem: which entry (email, else position), which field, and what is wrong. */
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

/** createInitialStaff's dependencies, injected so its refusal and ordering are testable. */
export interface InitDependencies {
  countUsers(): Promise<number>;
  /** Creates the account with NO usable password. */
  createAccount(details: InitAccountDetails): Promise<{ id: string; name: string; email: string }>;
  /** Mints a single-use link and emails it. */
  sendInvite(user: { id: string; name: string; email: string }): Promise<{ expiresAt: Date }>;
}
