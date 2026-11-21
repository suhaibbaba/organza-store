"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import type { User } from "@organza/shared/types/user";
import { DEFAULT_PAGE } from "@organza/shared/constants/pagination";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { DEFAULT_USER_FILTERS, USER_LIST_URL_PARAMS, USER_SEARCH_DEBOUNCE_MS } from "@/constants/users";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useUrlSearch } from "@/hooks/use-url-search";
import { useUsersQuery, useToggleUserActiveMutation } from "@/hooks/use-users";
import { useTranslateError } from "@/hooks/use-translate-error";
import { Alert, Button } from "@store/ui";
import { UserSearch } from "@/components/users/user-search";
import { UserFilters } from "@/components/users/user-filters";
import { UserCard } from "@/components/users/user-card";
import { UserTable } from "@/components/users/user-table";
import { UserPagination } from "@/components/users/user-pagination";
import { UserFormSheet } from "@/components/users/user-form-sheet";
import { UserRemoveSheet } from "@/components/users/user-remove-sheet";
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

  const [filters, setFilters] = useUrlFilters(DEFAULT_USER_FILTERS, USER_LIST_URL_PARAMS);
  const [searchInput, handleSearchChange] = useUrlSearch(
    filters.q,
    (q) => setFilters({ q, page: DEFAULT_PAGE }),
    USER_SEARCH_DEBOUNCE_MS
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useUsersQuery(filters);
  const toggleMutation = useToggleUserActiveMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
  // Reactivation only: switching off goes through the removal sheet, which explains deactivate vs erase.
  const [confirmActivateId, setConfirmActivateId] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [removingUser, setRemovingUser] = useState<User | null>(null);

  const hasAnyFilter = Boolean(filters.role) || filters.isActive !== null || filters.q.trim().length > 0;

  function updatePage(page: number) {
    setFilters({ page });
  }

  function handleRoleChange(role: UserListFilters["role"]) {
    setFilters({ role, page: DEFAULT_PAGE });
  }

  function handleIsActiveChange(isActive: UserListFilters["isActive"]) {
    setFilters({ isActive, page: DEFAULT_PAGE });
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

  function requestActivate(id: string) {
    setActivateError(null);
    setConfirmActivateId(id);
  }

  async function confirmActivate(user: User) {
    setActivateError(null);
    try {
      await toggleMutation.mutateAsync({ id: user.id, isActive: true });
      setConfirmActivateId(null);
    } catch (err) {
      setConfirmActivateId(null);
      setActivateError(translateError(err instanceof ApiError ? err.code : "error.internal"));
    }
  }

  function openRemove(user: User) {
    setActivateError(null);
    setRemovingUser(user);
  }

  const activatingId = toggleMutation.isPending ? (toggleMutation.variables?.id ?? null) : null;

  const rowActions = {
    onEdit: openEditForm,
    onRemove: openRemove,
    confirmActivateId,
    onRequestActivate: requestActivate,
    onCancelActivate: () => setConfirmActivateId(null),
    onConfirmActivate: (user: User) => void confirmActivate(user),
    activatingId,
  };
  const users = data?.users ?? [];

  return (
    <PageContainer>
      <PageHeader
        name="users"
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button className="shrink-0" onClick={openCreateForm} data-test-selector="add-user">
            <Plus className="size-4" aria-hidden="true" />
            {t("addUser")}
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <UserSearch value={searchInput} onChange={handleSearchChange} />
          <UserFilters
            role={filters.role}
            isActive={filters.isActive}
            onRoleChange={handleRoleChange}
            onIsActiveChange={handleIsActiveChange}
          />
        </div>

        {activateError && (
          <Alert tone="danger" data-testid="alert-destructive">
            {activateError}
          </Alert>
        )}

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
                <UserCard key={user.id} user={user} {...rowActions} />
              ))}
            </div>

            <div className="hidden md:block">
              <UserTable users={users} {...rowActions} />
            </div>

            {data?.meta && <UserPagination meta={data.meta} onPageChange={updatePage} />}
          </>
        )}

        <UserFormSheet open={formOpen} onOpenChange={setFormOpen} mode={formMode} user={editingUser} />
        <UserRemoveSheet
          user={removingUser}
          open={removingUser !== null}
          onOpenChange={(open) => !open && setRemovingUser(null)}
        />
      </div>
    </PageContainer>
  );
}
