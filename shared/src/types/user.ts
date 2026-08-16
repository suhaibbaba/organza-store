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
  // Has this account actually DONE anything in the shop — taken an order,
  // recorded an expense, opened a drawer, asked for a change, or written a
  // single audit entry?
  //
  // It is what decides whether "remove" can mean erase. An account with
  // history can only ever be deactivated: its name is on records that exist
  // to say who did what, and the database would either refuse the delete or
  // silently null the authorship out of them. An account with none — a
  // mistake, a duplicate, somebody who never started — can be deleted
  // outright.
  //
  // Sent so the screen can offer the honest choice up front rather than
  // discovering it from a refusal, but the API is still the authority: the
  // delete endpoint re-checks this itself (CLAUDE.md rule 5).
  hasHistory: boolean;
  createdAt: string;
  updatedAt: string;
}
