"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
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
import { SupplierTable } from "@/components/suppliers/supplier-table";
import { SupplierFormModal } from "@/components/suppliers/supplier-form-modal";
import { useSuppliersQuery } from "@/hooks/use-suppliers";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useUrlSearch } from "@/hooks/use-url-search";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import { DEFAULT_SUPPLIER_FILTERS, SUPPLIER_LIST_URL_PARAMS, SUPPLIER_SEARCH_DEBOUNCE_MS } from "@/constants/suppliers";
import type { SupplierFormTarget, SupplierListFilters } from "@/types/supplier";

export default function SuppliersPage() {
  return (
    <RoleGuard action="supplier.view">
      <SuppliersPageContent />
    </RoleGuard>
  );
}

function SuppliersPageContent() {
  const t = useTranslations("suppliers");
  const tCommon = useTranslations("common");
  const translateError = useTranslateError();
  const formatMoney = useMoneyFormatter();
  const router = useRouter();
  const { user } = useSession();
  const canManage = can(user, "supplier.manage");

  const [filters, changeFilters] = useUrlFilters(DEFAULT_SUPPLIER_FILTERS, SUPPLIER_LIST_URL_PARAMS);
  const [searchInput, setSearchInput] = useUrlSearch(
    filters.q,
    (q) => changeFilters({ q, page: DEFAULT_PAGE }),
    SUPPLIER_SEARCH_DEBOUNCE_MS,
  );
  const [formTarget, setFormTarget] = useState<SupplierFormTarget | null>(null);
  const list = useSuppliersQuery(filters);
  const suppliers = list.data?.suppliers ?? [];
  const meta = list.data?.meta ?? null;
  const hasFilters = Boolean(filters.q.trim() || filters.owing);

  const tableSort: TableSort = {
    key: filters.sortBy,
    dir: filters.sortDir,
    onChange: (key, dir) =>
      changeFilters(
        key === null
          ? { sortBy: DEFAULT_SUPPLIER_FILTERS.sortBy, sortDir: DEFAULT_SUPPLIER_FILTERS.sortDir, page: DEFAULT_PAGE }
          : { sortBy: key as SupplierListFilters["sortBy"], sortDir: dir, page: DEFAULT_PAGE },
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
          data-testid="suppliers-error"
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
    if (suppliers.length === 0) {
      return (
        <EmptyState
          data-testid="suppliers-empty"
          icon="store"
          title={hasFilters ? "suppliers.empty.noMatchesTitle" : "suppliers.empty.noneTitle"}
          hint={hasFilters ? "suppliers.empty.noMatchesHint" : "suppliers.empty.noneHint"}
        />
      );
    }
    return (
      <SupplierTable
        suppliers={suppliers}
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
        name="suppliers"
        title={t("title")}
        description={t("subtitle")}
        actions={
          canManage && (
            <Button
              className="shrink-0"
              data-test-selector="add-supplier"
              icon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => setFormTarget({ mode: "create" })}
            >
              {t("add")}
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-4">
        {meta && (
          <div className="grid grid-cols-2 gap-3 sm:max-w-xl sm:gap-4">
            <StatCard
              name="suppliers-total-owed"
              label={t("stats.totalOwed")}
              tooltip={t("stats.totalOwedHint")}
              value={formatMoney(meta.totalOwed)}
              tone="warning"
            />
            <StatCard name="suppliers-owing" label={t("stats.owingCount")} value={String(meta.owingCount)} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-64 flex-1 sm:max-w-md">
            <SearchField
              data-testid="suppliers-search"
              label={t("search.label")}
              placeholder={t("search.placeholder")}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onClear={() => setSearchInput("")}
              clearLabel={t("search.clear")}
            />
          </div>
          <ChipGroup data-testid="suppliers-filters">
            <Chip
              data-testid="suppliers-filter-owing"
              selected={filters.owing}
              onClick={() => changeFilters({ owing: !filters.owing, page: DEFAULT_PAGE })}
            >
              {t("filters.owing")}
            </Chip>
          </ChipGroup>
          {meta && (
            <div className="ms-auto flex h-(--control-h) items-center">
              <TotalBadge data-testid="suppliers-count" total={meta.total} />
            </div>
          )}
        </div>

        {renderList()}
      </div>

      <SupplierFormModal
        target={formTarget}
        onClose={() => setFormTarget(null)}
        onSaved={(supplier) => {
          if (formTarget?.mode === "create") {
            router.push(`/suppliers/${supplier.id}`);
          }
        }}
      />
    </PageContainer>
  );
}
