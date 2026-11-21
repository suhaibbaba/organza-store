import type { ReactNode } from "react";
import type { Role } from "@organza/shared/types/role";
import type { User } from "@organza/shared/types/user";
import type { Pagination } from "@organza/shared/types/common";
import type { ListUsersQuery } from "@organza/shared/schemas/user";
import type { TableSort } from "@store/ui";

// Client filter state for the users list; null means "not filtered".
export interface UserListFilters {
  q: string;
  role: Role | null;
  isActive: boolean | null;
  sortBy: ListUsersQuery["sortBy"];
  sortDir: ListUsersQuery["sortDir"];
  page: number;
  pageSize: number;
}

export type UserFiltersValue = Pick<UserListFilters, "role" | "isActive">;
export type UserSortValue = Pick<UserListFilters, "sortBy" | "sortDir">;

export interface UserSortOption {
  value: string;
  sortBy: UserListFilters["sortBy"];
  sortDir: UserListFilters["sortDir"];
  labelKey: string;
}

export interface UserRoleFilterProps {
  value: Role | null;
  onChange: (role: Role | null) => void;
}

export interface UserFiltersProps {
  value: UserFiltersValue;
  sort: UserSortValue;
  onApply: (value: UserFiltersValue, sort: UserSortValue) => void;
}

export interface UserFilterChipsProps {
  value: UserFiltersValue;
  onChange: (value: UserFiltersValue) => void;
}

export interface UserTableProps {
  users: User[];
  meta: Pagination | null;
  isLoading: boolean;
  isRefreshing: boolean;
  sort: TableSort;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  renderMenu: (user: User) => ReactNode;
}

export interface UserFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  user?: User | undefined;
}

export interface UserRemoveModalProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
