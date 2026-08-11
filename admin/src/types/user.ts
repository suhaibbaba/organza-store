import type { Role } from "@organza/shared/types/role";

// Client-side filter state for the users list screen — kept separate from
// the API's validated query shape so the UI can hold "unset" filters
// (CLAUDE.md rule 5: Users/staff management is Admin only).
export interface UserListFilters {
  q: string;
  role: Role | null;
  isActive: boolean | null;
  page: number;
}
