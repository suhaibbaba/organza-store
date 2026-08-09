"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { can } from "@shared/lib/permissions";
import { DEFAULT_PAGE } from "@shared/constants/pagination";
import { DEFAULT_LOW_STOCK_THRESHOLD } from "@shared/constants/inventory";
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
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { InventoryListFilters } from "@/types/inventory";

// Admin/Manager only (CLAUDE.md rule 5): stock is theirs to see and to
// change, so /api/inventory 403s for an Employee and the nav hides the entry.
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

  // Supports deep-linking from the dashboard's low-stock card
  // (/inventory?lowStock=true) — read once on mount, not kept in sync after.
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
  // ...and the row it happened on keeps its place, even once the change moves
  // it outside the filter the user is working under.
  const { rows, pin, release, outsideFilterCount } = useInventoryRows(data?.items ?? [], edits);

  const hasAnyFilter = Boolean(filters.categoryId) || filters.lowStock || debouncedSearch.trim().length > 0;

  // Every way of asking a different question of the list lets the held rows
  // go: the user is no longer looking at the view they were pinned in.
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
    // Remember where the row is BEFORE the change, so it can be put back
    // there whatever the re-sorted, re-filtered next read says.
    pin(item);
    setStock(item, next);
  }

  function refreshList() {
    release();
    void refetch();
  }

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="flex flex-col gap-4">
        {!canAdjust && <p className="text-sm text-muted-foreground">{t("readOnlyHint")}</p>}

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
            {/* Only while the user is waiting on a read they asked for. A
                background refetch — including the one each save triggers —
                must not put a spinner over rows somebody is working down. */}
            {isFetching && rows.length === 0 && <InventoryListSpinnerOverlay />}

            {/* The explicit way out of the held state, offered only once
                there is something being held. Pull-to-refresh does the same
                thing on an installed phone (lib/manual-refresh.ts). */}
            {outsideFilterCount > 0 && (
              <Alert className="flex-wrap items-center justify-between gap-3">
                <p>{t("outsideFilterNotice", { count: outsideFilterCount })}</p>
                <Button type="button" variant="outline" size="sm" onClick={refreshList}>
                  {t("refreshList")}
                </Button>
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
