"use client";

import { useTranslations } from "next-intl";
import { Alert, SaveBar, TotalBadge } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { DEFAULT_PAGE } from "@store/shared/constants/pagination";
import { DEFAULT_LOW_STOCK_THRESHOLD } from "@store/shared/constants/inventory";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";
import {
  DEFAULT_INVENTORY_FILTERS,
  INVENTORY_LIST_URL_PARAMS,
  INVENTORY_SEARCH_DEBOUNCE_MS,
} from "@/constants/inventory";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useUrlSearch } from "@/hooks/use-url-search";
import { useInventoryQuery } from "@/hooks/use-inventory";
import { useStockDrafts } from "@/hooks/use-stock-drafts";
import { useSettingsQuery } from "@/hooks/use-settings";
import { InventorySearch } from "@/components/inventory/inventory-search";
import {
  InventoryFilterChips,
  InventoryFilters,
  type InventoryFiltersValue,
} from "@/components/inventory/inventory-filters";
import { InventoryTable } from "@/components/inventory/inventory-table";
import {
  InventoryListEmpty,
  InventoryListError,
  InventoryListLoading,
} from "@/components/inventory/inventory-list-states";
import type { InventoryRow } from "@/types/inventory";

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

  const [filters, changeFilters] = useUrlFilters(DEFAULT_INVENTORY_FILTERS, INVENTORY_LIST_URL_PARAMS);
  const [searchInput, setSearchInput] = useUrlSearch(
    filters.q,
    (q) => changeFilters({ q, page: DEFAULT_PAGE }),
    INVENTORY_SEARCH_DEBOUNCE_MS,
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useInventoryQuery(filters);
  const { data: settings } = useSettingsQuery();
  const threshold = settings?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
  const stock = useStockDrafts();

  const rows: InventoryRow[] = (data?.items ?? []).map((item) => {
    const draft = stock.drafts[item.id];
    return { item, stock: draft?.value ?? item.stock, changed: Boolean(draft), failed: Boolean(draft?.failed) };
  });

  const filtersValue: InventoryFiltersValue = { categoryId: filters.categoryId, lowStock: filters.lowStock };
  const hasAnyFilter = Boolean(filters.categoryId) || filters.lowStock || filters.q.trim().length > 0;

  return (
    <PageContainer>
      <PageHeader name="inventory" title={t("title")} description={t("subtitle")} />

      <div className="flex flex-col gap-4 pb-20">
        {!canAdjust && <p className="text-label text-ink-muted">{t("readOnlyHint")}</p>}

        {stock.failedCount > 0 && (
          <Alert tone="danger" data-testid="inventory-save-failed">
            {t("save.failed", { count: stock.failedCount })}
          </Alert>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-64 flex-1 sm:max-w-md">
              <InventorySearch value={searchInput} onChange={setSearchInput} />
            </div>
            <InventoryFilters value={filtersValue} onApply={(next) => changeFilters({ ...next, page: DEFAULT_PAGE })} />
            {data?.meta && (
              <span className="ms-auto flex h-(--control-h) items-center">
                <TotalBadge data-testid="inventory-count" total={data.meta.total} />
              </span>
            )}
          </div>
          <InventoryFilterChips
            value={filtersValue}
            onChange={(next) => changeFilters({ ...next, page: DEFAULT_PAGE })}
          />
        </div>

        {isLoading ? (
          <InventoryListLoading />
        ) : isError ? (
          <InventoryListError error={error} onRetry={() => void refetch()} />
        ) : rows.length === 0 ? (
          <InventoryListEmpty hasFilters={hasAnyFilter} />
        ) : (
          <InventoryTable
            rows={rows}
            meta={data?.meta ?? null}
            threshold={threshold}
            canAdjust={canAdjust}
            isRefreshing={isFetching}
            onStockChange={stock.setStock}
            onPageChange={(page) => changeFilters({ page })}
            onPageSizeChange={(pageSize) => changeFilters({ pageSize, page: DEFAULT_PAGE })}
          />
        )}
      </div>

      <SaveBar
        data-testid="inventory-save"
        visible={stock.count > 0 || stock.saving}
        saving={stock.saving}
        message={t("save.changed", { count: stock.count })}
        onSave={() => void stock.save()}
        onDiscard={stock.discard}
      />
    </PageContainer>
  );
}
