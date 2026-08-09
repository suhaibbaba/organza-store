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

  const hasAnyFilter = Boolean(filters.categoryId) || filters.lowStock || debouncedSearch.trim().length > 0;

  function updatePage(page: number) {
    setFilters((f) => ({ ...f, page }));
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    setFilters((f) => ({ ...f, page: DEFAULT_PAGE }));
  }

  function handleCategoryChange(categoryId: string | null) {
    setFilters((f) => ({ ...f, categoryId, page: DEFAULT_PAGE }));
  }

  function handleLowStockChange(lowStock: boolean) {
    setFilters((f) => ({ ...f, lowStock, page: DEFAULT_PAGE }));
  }

  const items = data?.items ?? [];

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
        ) : items.length === 0 ? (
          <InventoryListEmpty hasFilters={hasAnyFilter} />
        ) : (
          <>
            {isFetching && <InventoryListSpinnerOverlay />}

            <div className="flex flex-col gap-3 md:hidden">
              {items.map((item) => (
                <InventoryCard key={item.id} item={item} threshold={threshold} canAdjust={canAdjust} />
              ))}
            </div>

            <div className="hidden md:block">
              <InventoryTable items={items} threshold={threshold} canAdjust={canAdjust} />
            </div>

            {data?.meta && <InventoryPagination meta={data.meta} onPageChange={updatePage} />}
          </>
        )}
      </div>
    </PageContainer>
  );
}
