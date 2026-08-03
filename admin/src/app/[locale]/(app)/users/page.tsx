"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import type { User } from "@shared/types/user";
import { DEFAULT_PAGE } from "@shared/constants/pagination";
import { RoleGuard } from "@/components/auth/role-guard";
import { DEFAULT_USER_FILTERS, USER_SEARCH_DEBOUNCE_MS } from "@/constants/users";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useUsersQuery, useToggleUserActiveMutation } from "@/hooks/use-users";
import { useTranslateError } from "@/hooks/use-translate-error";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { UserSearch } from "@/components/users/user-search";
import { UserFilters } from "@/components/users/user-filters";
import { UserCard } from "@/components/users/user-card";
import { UserTable } from "@/components/users/user-table";
import { UserPagination } from "@/components/users/user-pagination";
import { UserFormSheet } from "@/components/users/user-form-sheet";
import { UserListEmpty, UserListError, UserListLoading, UserListSpinnerOverlay } from "@/components/users/user-list-states";
import { ApiError } from "@/lib/api/errors";
import type { UserListFilters } from "@/types/user";

export default function UsersPage() {
  return (
    <RoleGuard action="user.manage">
      <UsersPageContent />
    </RoleGuard>
  );
}

function UsersPageContent() {
  const t = useTranslations("users");
  const translateError = useTranslateError();

  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<UserListFilters>(DEFAULT_USER_FILTERS);
  const debouncedSearch = useDebouncedValue(searchInput, USER_SEARCH_DEBOUNCE_MS);

  const effectiveFilters = useMemo<UserListFilters>(() => ({ ...filters, q: debouncedSearch }), [filters, debouncedSearch]);

  const { data, isLoading, isFetching, isError, error, refetch } = useUsersQuery(effectiveFilters);
  const toggleMutation = useToggleUserActiveMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
  const [confirmToggleId, setConfirmToggleId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const hasAnyFilter = Boolean(filters.role) || filters.isActive !== null || debouncedSearch.trim().length > 0;

  function updatePage(page: number) {
    setFilters((f) => ({ ...f, page }));
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    setFilters((f) => ({ ...f, page: DEFAULT_PAGE }));
  }

  function handleRoleChange(role: UserListFilters["role"]) {
    setFilters((f) => ({ ...f, role, page: DEFAULT_PAGE }));
  }

  function handleIsActiveChange(isActive: UserListFilters["isActive"]) {
    setFilters((f) => ({ ...f, isActive, page: DEFAULT_PAGE }));
  }

  function openCreateForm() {
    setFormMode("create");
    setEditingUser(undefined);
    setFormOpen(true);
  }

  function openEditForm(user: User) {
    setFormMode("edit");
    setEditingUser(user);
    setFormOpen(true);
  }

  function requestToggle(id: string) {
    setToggleError(null);
    setConfirmToggleId(id);
  }

  async function confirmToggle(user: User) {
    setToggleError(null);
    try {
      await toggleMutation.mutateAsync({ id: user.id, isActive: !user.isActive });
      setConfirmToggleId(null);
    } catch (err) {
      setConfirmToggleId(null);
      setToggleError(translateError(err instanceof ApiError ? err.code : "error.internal"));
    }
  }

  const togglingId = toggleMutation.isPending ? (toggleMutation.variables?.id ?? null) : null;
  const users = data?.users ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button size="sm" className="shrink-0" onClick={openCreateForm}>
          <Plus className="size-4" aria-hidden="true" />
          {t("addUser")}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <UserSearch value={searchInput} onChange={handleSearchChange} />
        <UserFilters
          role={filters.role}
          isActive={filters.isActive}
          onRoleChange={handleRoleChange}
          onIsActiveChange={handleIsActiveChange}
        />
      </div>

      {toggleError && <Alert variant="destructive">{toggleError}</Alert>}

      {isLoading ? (
        <UserListLoading />
      ) : isError ? (
        <UserListError error={error} onRetry={() => void refetch()} />
      ) : users.length === 0 ? (
        <UserListEmpty hasFilters={hasAnyFilter} />
      ) : (
        <>
          {isFetching && <UserListSpinnerOverlay />}

          <div className="flex flex-col gap-3 md:hidden">
            {users.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                onEdit={openEditForm}
                confirmToggleId={confirmToggleId}
                onRequestToggle={requestToggle}
                onCancelToggle={() => setConfirmToggleId(null)}
                onConfirmToggle={(u) => void confirmToggle(u)}
                togglingId={togglingId}
              />
            ))}
          </div>

          <div className="hidden md:block">
            <UserTable
              users={users}
              onEdit={openEditForm}
              confirmToggleId={confirmToggleId}
              onRequestToggle={requestToggle}
              onCancelToggle={() => setConfirmToggleId(null)}
              onConfirmToggle={(u) => void confirmToggle(u)}
              togglingId={togglingId}
            />
          </div>

          {data?.meta && <UserPagination meta={data.meta} onPageChange={updatePage} />}
        </>
      )}

      <UserFormSheet open={formOpen} onOpenChange={setFormOpen} mode={formMode} user={editingUser} />
    </div>
  );
}
