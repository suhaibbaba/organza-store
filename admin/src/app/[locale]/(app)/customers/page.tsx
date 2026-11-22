"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { HandCoins, Plus, Users } from "lucide-react";
import {
  Alert,
  Button,
  Chip,
  ChipGroup,
  EmptyState,
  SearchField,
  Skeleton,
  TotalBadge,
  type TableSort,
} from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { DEFAULT_PAGE } from "@store/shared/constants/pagination";
import { RoleGuard } from "@/components/auth/role-guard";
import { useSession } from "@/components/providers/session-provider";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { CustomerTable } from "@/components/customers/customer-table";
import { CustomerFormModal } from "@/components/customers/customer-form-modal";
import { useCustomersQuery } from "@/hooks/use-customers";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useUrlSearch } from "@/hooks/use-url-search";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import { CUSTOMER_LIST_URL_PARAMS, CUSTOMER_SEARCH_DEBOUNCE_MS, DEFAULT_CUSTOMER_FILTERS } from "@/constants/customers";
import type { CustomerFormTarget, CustomerListFilters } from "@/types/customer";

export default function CustomersPage() {
  return (
    <RoleGuard action="customer.view">
      <CustomersPageContent />
    </RoleGuard>
  );
}

function CustomersPageContent() {
  const t = useTranslations("customers");
  const tCommon = useTranslations("common");
  const translateError = useTranslateError();
  const formatMoney = useMoneyFormatter();
  const router = useRouter();
  const { user } = useSession();
  const canManage = can(user, "customer.manage");

  const [filters, changeFilters] = useUrlFilters(DEFAULT_CUSTOMER_FILTERS, CUSTOMER_LIST_URL_PARAMS);
  const [searchInput, setSearchInput] = useUrlSearch(
    filters.q,
    (q) => changeFilters({ q, page: DEFAULT_PAGE }),
    CUSTOMER_SEARCH_DEBOUNCE_MS,
  );
  const [formTarget, setFormTarget] = useState<CustomerFormTarget | null>(null);
  const list = useCustomersQuery(filters);
  const customers = list.data?.customers ?? [];
  const meta = list.data?.meta ?? null;
  const hasFilters = Boolean(filters.q.trim() || filters.owing || filters.keptPieces);

  const tableSort: TableSort = {
    key: filters.sortBy,
    dir: filters.sortDir,
    onChange: (key, dir) =>
      changeFilters(
        key === null
          ? { sortBy: DEFAULT_CUSTOMER_FILTERS.sortBy, sortDir: DEFAULT_CUSTOMER_FILTERS.sortDir, page: DEFAULT_PAGE }
          : { sortBy: key as CustomerListFilters["sortBy"], sortDir: dir, page: DEFAULT_PAGE },
      ),
  };

  function renderList() {
    if (list.isLoading) {
      return <Skeleton className="h-72 rounded-card" />;
    }
    if (list.error) {
      return (
        <Alert
          tone="danger"
          data-testid="customers-error"
          action={
            <Button type="button" variant="secondary" onClick={() => void list.refetch()}>
              {tCommon("retry")}
            </Button>
          }
        >
          {translateError(list.error instanceof ApiError ? list.error.code : "error.internal")}
        </Alert>
      );
    }
    if (customers.length === 0) {
      return (
        <EmptyState
          data-testid="customers-empty"
          icon="users"
          title={hasFilters ? "customers.empty.noMatchesTitle" : "customers.empty.noneTitle"}
          hint={hasFilters ? "customers.empty.noMatchesHint" : "customers.empty.noneHint"}
        />
      );
    }
    return (
      <CustomerTable
        customers={customers}
        meta={meta}
        isRefreshing={list.isFetching}
        sort={tableSort}
        onPageChange={(page) => changeFilters({ page })}
        onPageSizeChange={(pageSize) => changeFilters({ pageSize, page: DEFAULT_PAGE })}
      />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        name="customers"
        title={t("title")}
        description={t("subtitle")}
        actions={
          canManage && (
            <Button
              className="shrink-0"
              data-test-selector="add-customer"
              icon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => setFormTarget({ mode: "create" })}
            >
              {t("add")}
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-4">
        {/* Shop-wide money total: sent only to dashboard.view (rule 19). */}
        {meta?.totalDebt !== undefined && (
          <div className="grid grid-cols-2 gap-3 sm:max-w-xl sm:gap-4">
            <StatCard
              name="customers-total-debt"
              icon={HandCoins}
              label={t("stats.totalDebt")}
              tooltip={t("stats.totalDebtHint")}
              value={formatMoney(meta.totalDebt)}
              tone="warning"
            />
            <StatCard
              name="customers-owing"
              icon={Users}
              label={t("stats.owingCount")}
              value={String(meta.owingCount ?? 0)}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-64 flex-1 sm:max-w-md">
            <SearchField
              data-testid="customers-search"
              label={t("search.label")}
              placeholder={t("search.placeholder")}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onClear={() => setSearchInput("")}
              clearLabel={t("search.clear")}
            />
          </div>
          <ChipGroup data-testid="customers-filters">
            <Chip
              data-testid="customers-filter-owing"
              selected={filters.owing}
              onClick={() => changeFilters({ owing: !filters.owing, page: DEFAULT_PAGE })}
            >
              {t("filters.owing")}
            </Chip>
            <Chip
              data-testid="customers-filter-kept"
              selected={filters.keptPieces}
              onClick={() => changeFilters({ keptPieces: !filters.keptPieces, page: DEFAULT_PAGE })}
            >
              {t("filters.kept")}
            </Chip>
          </ChipGroup>
          {meta && (
            <div className="ms-auto flex h-(--control-h) items-center">
              <TotalBadge data-testid="customers-count" total={meta.total} />
            </div>
          )}
        </div>

        {renderList()}
      </div>

      <CustomerFormModal
        target={formTarget}
        onClose={() => setFormTarget(null)}
        onSaved={(customer) => {
          if (formTarget?.mode === "create") {
            router.push(`/customers/${customer.id}`);
          }
        }}
      />
    </PageContainer>
  );
}
