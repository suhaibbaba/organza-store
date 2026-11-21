"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { can } from "@organza/shared/lib/permissions";
import { DEFAULT_PAGE } from "@organza/shared/constants/pagination";
import { DEFAULT_LOW_STOCK_THRESHOLD } from "@organza/shared/constants/inventory";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";
import { DEFAULT_INVENTORY_FILTERS, INVENTORY_SEARCH_DEBOUNCE_MS } from "@/constants/inventory";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInventoryQuery } from "@/hooks/use-inventory";
import { useInventoryRows } from "@/hooks/use-inventory-rows";
import { useStockEdits } from "@/hooks/use-stock-edits";
import { useSettingsQuery } from "@/hooks/use-settings";
import { InventorySearch } from "@/components/inventory/inventory-search";
import { InventoryFilters } from "@/components/inventory/inventory-filters";
import { InventoryCard } from "@/components/inventory/inventory-card";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { InventoryPagination } from "@/components/inventory/inventory-pagination";
import {
  InventoryListEmpty,
  InventoryListError,
  InventoryListLoading,
  InventoryListSpinnerOverlay,
} from "@/components/inventory/inventory-list-states";
import { Alert, Button } from "@store/ui";
import type { InventoryListFilters } from "@/types/inventory";

// Admin/Manager only (rule 5): /api/inventory 403s for an Employee.
export default function InventoryPage() {
  return (
    <RoleGuard action="inventory.view">
      <InventoryPageContent />
    </RoleGuard>
  );
}

function InventoryPageContent() {
  const t = useTranslations("inventory");
  const { user } = useSession();
  const canAdjust = can(user, "inventory.adjust");

  // ?lowStock=true deep link from the dashboard, read once on mount.
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<InventoryListFilters>(() => ({
    ...DEFAULT_INVENTORY_FILTERS,
    lowStock: searchParams.get("lowStock") === "true",
  }));
  const debouncedSearch = useDebouncedValue(searchInput, INVENTORY_SEARCH_DEBOUNCE_MS);

  const effectiveFilters = useMemo<InventoryListFilters>(
    () => ({ ...filters, q: debouncedSearch }),
    [filters, debouncedSearch]
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useInventoryQuery(effectiveFilters);
  const { data: settings } = useSettingsQuery();
  const threshold = settings?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

  // A run of +/- presses is one saved change, not one per press.
  const { edits, setStock } = useStockEdits();
  // ...and the edited row keeps its place even once it falls outside the filter.
  const { rows, pin, release, outsideFilterCount } = useInventoryRows(data?.items ?? [], edits);

  const hasAnyFilter = Boolean(filters.categoryId) || filters.lowStock || debouncedSearch.trim().length > 0;

  // Any new question of the list lets the held rows go.
  function changeFilters(next: Partial<InventoryListFilters>) {
    release();
    setFilters((f) => ({ ...f, ...next }));
  }

  function updatePage(page: number) {
    changeFilters({ page });
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    changeFilters({ page: DEFAULT_PAGE });
  }

  function handleCategoryChange(categoryId: string | null) {
    changeFilters({ categoryId, page: DEFAULT_PAGE });
  }

  function handleLowStockChange(lowStock: boolean) {
    changeFilters({ lowStock, page: DEFAULT_PAGE });
  }

  function handleStockChange(item: Parameters<typeof setStock>[0], next: number) {
    // Pin the row's position before the change so the next read can't move it.
    pin(item);
    setStock(item, next);
  }

  function refreshList() {
    release();
    void refetch();
  }

  return (
    <PageContainer>
      <PageHeader name="inventory" title={t("title")} description={t("subtitle")} />

      <div className="flex flex-col gap-4">
        {!canAdjust && <p className="text-label text-ink-muted">{t("readOnlyHint")}</p>}

        <div className="flex flex-col gap-3">
          <InventorySearch value={searchInput} onChange={handleSearchChange} />
          <InventoryFilters
            categoryId={filters.categoryId}
            lowStock={filters.lowStock}
            lowStockCount={filters.lowStock ? (data?.meta?.total ?? null) : null}
            onCategoryChange={handleCategoryChange}
            onLowStockChange={handleLowStockChange}
          />
        </div>

        {isLoading ? (
          <InventoryListLoading />
        ) : isError ? (
          <InventoryListError error={error} onRetry={() => void refetch()} />
        ) : rows.length === 0 ? (
          <InventoryListEmpty hasFilters={hasAnyFilter} />
        ) : (
          <>
            {/* Never over rows being worked down: a save's background refetch shows no spinner. */}
            {isFetching && rows.length === 0 && <InventoryListSpinnerOverlay />}

            {/* The way out of the held state (pull-to-refresh does the same on an installed phone). */}
            {outsideFilterCount > 0 && (
              <Alert
                tone="info"
                data-testid="alert-default"
                action={
                  <Button type="button" variant="secondary" size="sm" onClick={refreshList}>
                    {t("refreshList")}
                  </Button>
                }
              >
                {t("outsideFilterNotice", { count: outsideFilterCount })}
              </Alert>
            )}

            <div className="flex flex-col gap-3 md:hidden">
              {rows.map((row) => (
                <InventoryCard
                  key={row.item.id}
                  row={row}
                  threshold={threshold}
                  canAdjust={canAdjust}
                  onStockChange={handleStockChange}
                />
              ))}
            </div>

            <div className="hidden md:block">
              <InventoryTable
                rows={rows}
                threshold={threshold}
                canAdjust={canAdjust}
                onStockChange={handleStockChange}
              />
            </div>

            {data?.meta && <InventoryPagination meta={data.meta} onPageChange={updatePage} />}
          </>
        )}
      </div>
    </PageContainer>
  );
}
