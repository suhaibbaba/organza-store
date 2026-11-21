"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button, TotalBadge, type TableSort } from "@store/ui";
import type { User } from "@store/shared/types/user";
import { DEFAULT_PAGE } from "@store/shared/constants/pagination";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { DEFAULT_USER_FILTERS, USER_LIST_URL_PARAMS, USER_SEARCH_DEBOUNCE_MS } from "@/constants/users";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useUrlSearch } from "@/hooks/use-url-search";
import { useUsersQuery } from "@/hooks/use-users";
import { UserSearch } from "@/components/users/user-search";
import { UserFilterChips, UserFilters, UserRoleFilter, countUserFilters } from "@/components/users/user-filters";
import { UserTable } from "@/components/users/user-table";
import { useUserRowMenu } from "@/components/users/user-row-menu";
import { UserFormModal } from "@/components/users/user-form-modal";
import { UserRemoveModal } from "@/components/users/user-remove-modal";
import { UserListEmpty, UserListError } from "@/components/users/user-list-states";
import type { UserFiltersValue, UserListFilters, UserSortValue } from "@/types/user";

export default function UsersPage() {
  return (
    <RoleGuard action="user.manage">
      <UsersPageContent />
    </RoleGuard>
  );
}

function UsersPageContent() {
  const t = useTranslations("users");
  const [filters, changeFilters] = useUrlFilters(DEFAULT_USER_FILTERS, USER_LIST_URL_PARAMS);
  const [searchInput, setSearchInput] = useUrlSearch(
    filters.q,
    (q) => changeFilters({ q, page: DEFAULT_PAGE }),
    USER_SEARCH_DEBOUNCE_MS,
  );
  const { data, isLoading, isFetching, isError, error, refetch } = useUsersQuery(filters);

  const [form, setForm] = useState<{ open: boolean; mode: "create" | "edit"; user?: User }>({
    open: false,
    mode: "create",
  });
  const [removingUser, setRemovingUser] = useState<User | null>(null);
  const menu = useUserRowMenu({
    onEdit: (user) => setForm({ open: true, mode: "edit", user }),
    onRemove: setRemovingUser,
  });

  const filtersValue: UserFiltersValue = { role: filters.role, isActive: filters.isActive };
  const sortValue: UserSortValue = { sortBy: filters.sortBy, sortDir: filters.sortDir };
  const hasAnyFilter = countUserFilters(filtersValue) > 0 || filters.q.trim().length > 0;

  const tableSort: TableSort = {
    key: filters.sortBy,
    dir: filters.sortDir,
    onChange: (key, dir) =>
      changeFilters(
        key === null
          ? { sortBy: DEFAULT_USER_FILTERS.sortBy, sortDir: DEFAULT_USER_FILTERS.sortDir, page: DEFAULT_PAGE }
          : { sortBy: key as UserListFilters["sortBy"], sortDir: dir, page: DEFAULT_PAGE },
      ),
  };

  const users = data?.users ?? [];

  return (
    <PageContainer>
      <PageHeader
        name="users"
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button
            className="shrink-0"
            onClick={() => setForm({ open: true, mode: "create" })}
            data-test-selector="add-user"
            icon={<Plus className="size-4" aria-hidden="true" />}
          >
            {t("addUser")}
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-64 flex-1 sm:max-w-md">
              <UserSearch value={searchInput} onChange={setSearchInput} />
            </div>
            <UserRoleFilter value={filters.role} onChange={(role) => changeFilters({ role, page: DEFAULT_PAGE })} />
            <UserFilters
              value={filtersValue}
              sort={sortValue}
              onApply={(next, sort) => changeFilters({ ...next, ...sort, page: DEFAULT_PAGE })}
            />
            {data?.meta && (
              <div className="ms-auto flex h-(--control-h) items-center">
                <TotalBadge data-testid="users-count" total={data.meta.total} />
              </div>
            )}
          </div>
          <UserFilterChips value={filtersValue} onChange={(next) => changeFilters({ ...next, page: DEFAULT_PAGE })} />
        </div>

        {isError ? (
          <UserListError error={error} onRetry={() => void refetch()} />
        ) : !isLoading && users.length === 0 ? (
          <UserListEmpty hasFilters={hasAnyFilter} />
        ) : (
          <UserTable
            users={users}
            meta={data?.meta ?? null}
            isLoading={isLoading}
            isRefreshing={isFetching && !isLoading}
            sort={tableSort}
            onPageChange={(page) => changeFilters({ page })}
            onPageSizeChange={(pageSize) => changeFilters({ pageSize, page: DEFAULT_PAGE })}
            renderMenu={menu.renderMenu}
          />
        )}
      </div>

      <UserFormModal
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        mode={form.mode}
        user={form.user}
      />
      <UserRemoveModal
        user={removingUser}
        open={removingUser !== null}
        onOpenChange={(open) => !open && setRemovingUser(null)}
      />
      {menu.dialog}
    </PageContainer>
  );
}
