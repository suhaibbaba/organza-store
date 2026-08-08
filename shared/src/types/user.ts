import type { Role } from "@/types/role";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string;
  whatsapp: string | null;
  // SENSITIVE (CLAUDE.md rule 19): Admin only.
  idNumber: string | null;
  isActive: boolean;
  // Has this person finished setting up? An account is created with NO
  // password and its owner chooses one from an emailed link (CLAUDE.md rule
  // 17), so "invited, but never signed in" is an ordinary state and a
  // different thing from `isActive` — which says whether the account is
  // allowed to sign in at all. Never the password itself, in any form.
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}
