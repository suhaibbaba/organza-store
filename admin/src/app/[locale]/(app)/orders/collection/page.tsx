"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, EmptyState, SearchField, TotalBadge, type TableSort } from "@store/ui";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { DEFAULT_PAGE } from "@organza/shared/constants/pagination";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { COLLECTION_ORDER_FILTERS, COLLECTION_ORDER_URL_PARAMS, ORDER_SEARCH_DEBOUNCE_MS } from "@/constants/orders";
import { useCollectOrdersMutation, useCollectionSummaryQuery, useOrdersQuery } from "@/hooks/use-orders";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useUrlSearch } from "@/hooks/use-url-search";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { fromCents, toCents } from "@/lib/money";
import { OrderListError } from "@/components/orders/order-list-states";
import { CollectionSummaryCards } from "@/components/orders/collection/collection-summary-cards";
import { CollectionTable } from "@/components/orders/collection/collection-table";
import { OrderFilterChips, OrderFilters, countOrderFilters } from "@/components/orders/order-filters";
import { CollectionActionBar } from "@/components/orders/collection/collection-action-bar";
import type { OrderFiltersValue, OrderListFilters, OrderSortValue } from "@/types/order";

// Unpaid sales oldest first, to tick off as settled. Gated on order.markCollected: the shop-wide total is refused to an Employee (rule 19).
export default function OrderCollectionPage() {
  return (
    <RoleGuard action="order.markCollected">
      <OrderCollectionPageContent />
    </RoleGuard>
  );
}

function OrderCollectionPageContent() {
  const t = useTranslations("orders");
  const translateError = useTranslateError();

  const [filters, setUrlFilters] = useUrlFilters(COLLECTION_ORDER_FILTERS, COLLECTION_ORDER_URL_PARAMS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useUrlSearch(
    filters.q,
    (q) => changeFilters({ q, page: DEFAULT_PAGE }),
    ORDER_SEARCH_DEBOUNCE_MS
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useOrdersQuery(filters);
  const summaryQuery = useCollectionSummaryQuery();
  const mutation = useCollectOrdersMutation();

  const orders = useMemo(() => data?.orders ?? [], [data]);

  // Only what is on screen counts: a page-1 selection must never be settled from page 2.
  const selectedOnPage = useMemo(() => orders.filter((order) => selectedIds.includes(order.id)), [orders, selectedIds]);
  const selectedAmount = fromCents(selectedOnPage.reduce((sum, order) => sum + toCents(order.outstanding ?? order.total), 0));

  function changeFilters(next: Partial<OrderListFilters>) {
    setSelectedIds([]);
    setUrlFilters(next);
  }

  function toggle(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((one) => one !== id) : [...ids, id]));
  }

  function confirm() {
    mutation.mutate(
      selectedOnPage.map((order) => order.id),
      {
        onSuccess: () => {
          setSelectedIds([]);
          // Settled orders leave the list, which can empty this page.
          setUrlFilters({ page: DEFAULT_PAGE });
        },
      }
    );
  }

  // Payment is fixed to "unpaid" here, so it is neither a filter nor a chip.
  const filtersValue: OrderFiltersValue = {
    status: filters.status,
    channel: filters.channel,
    paymentStatus: null,
    hasQuickSale: filters.hasQuickSale,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };
  const sortValue: OrderSortValue = { sortBy: filters.sortBy, sortDir: filters.sortDir };

  function applyFilters(next: OrderFiltersValue, sort?: OrderSortValue) {
    changeFilters({ ...next, ...sort, paymentStatus: COLLECTION_ORDER_FILTERS.paymentStatus, page: DEFAULT_PAGE });
  }

  const tableSort: TableSort = {
    key: filters.sortBy,
    dir: filters.sortDir,
    onChange: (key, dir) =>
      key === null
        ? changeFilters({ sortBy: COLLECTION_ORDER_FILTERS.sortBy, sortDir: COLLECTION_ORDER_FILTERS.sortDir, page: DEFAULT_PAGE })
        : changeFilters({ sortBy: key as OrderListFilters["sortBy"], sortDir: dir, page: DEFAULT_PAGE }),
  };

  const isFiltered = filters.q.trim().length > 0 || countOrderFilters(filtersValue) > 0;

  return (
    <PageContainer>
      <PageHeader name="collection" title={t("collection.title")} description={t("collection.subtitle")} />
      <div className="flex flex-col gap-4">
        {summaryQuery.data && <CollectionSummaryCards summary={summaryQuery.data} />}

        {mutation.isError && (
          <Alert tone="danger" data-testid="alert-destructive">
            {translateError(mutation.error instanceof ApiError ? mutation.error.code : ERROR_CODES.INTERNAL)}
          </Alert>
        )}
        {mutation.isSuccess && !mutation.isPending && (
          <Alert tone="success" data-testid="alert-success">
            {t("collection.marked", { count: mutation.data.collectedIds.length })}
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-64 flex-1 sm:max-w-md">
            <SearchField
              label={t("search.label")}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onClear={() => setSearchInput("")}
              clearLabel={t("search.clear")}
              placeholder={t("search.placeholder")}
              data-testid="collection-search"
            />
          </div>
          <OrderFilters value={filtersValue} sort={sortValue} omit={["paymentStatus"]} onApply={applyFilters} />
          {data?.meta && (
            <div className="ms-auto flex h-(--control-h) items-center">
              <TotalBadge data-testid="collection-count" total={data.meta.total} />
            </div>
          )}
        </div>
        <OrderFilterChips value={filtersValue} onChange={(next) => applyFilters(next)} />

        {isError ? (
          <OrderListError error={error} onRetry={() => void refetch()} />
        ) : !isLoading && orders.length === 0 ? (
          isFiltered ? (
            <EmptyState
              data-testid="collection-no-results"
              icon="search"
              title="orders.collection.noResults.title"
              hint="orders.collection.noResults.description"
            />
          ) : (
            <EmptyState
              data-testid="collection-empty"
              icon="coins"
              title="orders.collection.empty.title"
              hint="orders.collection.empty.description"
            />
          )
        ) : (
          <CollectionTable
            orders={orders}
            meta={data?.meta ?? null}
            isRefreshing={isFetching && !isLoading}
            sort={tableSort}
            selectedIds={selectedIds}
            onToggle={toggle}
            onToggleAll={(select) => setSelectedIds(select ? orders.map((order) => order.id) : [])}
            onPageChange={(page) => changeFilters({ page })}
            onPageSizeChange={(pageSize) => changeFilters({ pageSize, page: DEFAULT_PAGE })}
          />
        )}

        {selectedOnPage.length > 0 && <div className="h-32" aria-hidden="true" />}
        <CollectionActionBar
          count={selectedOnPage.length}
          amount={selectedAmount}
          isPending={mutation.isPending}
          onConfirm={confirm}
          onClear={() => setSelectedIds([])}
        />
      </div>
    </PageContainer>
  );
}
