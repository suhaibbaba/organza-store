"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { HandCoins, Plus } from "lucide-react";
import { SearchField, TotalBadge, buttonClassName, type TableSort } from "@store/ui";
import { can } from "@organza/shared/lib/permissions";
import { DEFAULT_PAGE } from "@organza/shared/constants/pagination";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { DEFAULT_ORDER_FILTERS, ORDER_SEARCH_DEBOUNCE_MS } from "@/constants/orders";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useOrdersQuery } from "@/hooks/use-orders";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import {
  countOrderFilters,
  OrderFilterChips,
  OrderFilters,
  type OrderFiltersValue,
  type OrderSortValue,
} from "@/components/orders/order-filters";
import { OrderTable } from "@/components/orders/order-table";
import { OrderListEmpty, OrderListError, OrderListLoading } from "@/components/orders/order-list-states";
import type { OrderListFilters } from "@/types/order";

export default function OrdersPage() {
  const t = useTranslations("orders");
  const { user } = useSession();
  const canCreate = can(user, "order.create");
  const canCollect = can(user, "order.markCollected");

  // The header search's "see all" opens this list already searched (?q=).
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(urlQuery);
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);
  if (urlQuery !== seenUrlQuery) {
    setSeenUrlQuery(urlQuery);
    setSearchInput(urlQuery);
  }
  const [filters, setFilters] = useState<OrderListFilters>(DEFAULT_ORDER_FILTERS);
  const debouncedSearch = useDebouncedValue(searchInput, ORDER_SEARCH_DEBOUNCE_MS);
  const effectiveFilters = useMemo(() => ({ ...filters, q: debouncedSearch }), [filters, debouncedSearch]);

  const { data, isLoading, isFetching, isError, error, refetch } = useOrdersQuery(effectiveFilters);
  const orders = data?.orders ?? [];

  const filtersValue: OrderFiltersValue = {
    status: filters.status,
    channel: filters.channel,
    paymentStatus: filters.paymentStatus,
    hasQuickSale: filters.hasQuickSale,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };
  const sortValue: OrderSortValue = { sortBy: filters.sortBy, sortDir: filters.sortDir };
  const hasAnyFilter = countOrderFilters(filtersValue) > 0 || debouncedSearch.trim().length > 0;

  function changeFilters(next: Partial<OrderListFilters>) {
    setFilters((f) => ({ ...f, ...next }));
  }

  const tableSort: TableSort = {
    key: filters.sortBy,
    dir: filters.sortDir,
    onChange: (key, dir) =>
      changeFilters(
        key === null
          ? { sortBy: DEFAULT_ORDER_FILTERS.sortBy, sortDir: DEFAULT_ORDER_FILTERS.sortDir, page: DEFAULT_PAGE }
          : { sortBy: key as OrderListFilters["sortBy"], sortDir: dir, page: DEFAULT_PAGE }
      ),
  };

  return (
    <PageContainer>
      <PageHeader
        name="orders"
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            {canCollect && (
              <Link
                href="/orders/collection"
                data-test-selector="orders-collection-link"
                className={buttonClassName({ variant: "secondary", className: "shrink-0" })}
              >
                <HandCoins className="size-4" aria-hidden="true" />
                {t("collectionLink")}
              </Link>
            )}
            {canCreate && (
              <Link
                href="/orders/new"
                data-test-selector="add-order"
                className={buttonClassName({ className: "shrink-0" })}
              >
                <Plus className="size-4" aria-hidden="true" />
                {t("newOrder")}
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-64 flex-1 sm:max-w-md">
              <SearchField
                label={t("search.label")}
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  changeFilters({ page: DEFAULT_PAGE });
                }}
                onClear={() => {
                  setSearchInput("");
                  changeFilters({ page: DEFAULT_PAGE });
                }}
                clearLabel={t("search.clear")}
                placeholder={t("search.placeholder")}
                data-testid="orders-search"
              />
            </div>
            <OrderFilters
              value={filtersValue}
              sort={sortValue}
              onApply={(next, sort) => changeFilters({ ...next, ...sort, page: DEFAULT_PAGE })}
            />
            {data?.meta && (
              <span className="ms-auto flex h-(--control-h) items-center">
                <TotalBadge data-testid="orders-count" total={data.meta.total} />
              </span>
            )}
          </div>
          <OrderFilterChips value={filtersValue} onChange={(next) => changeFilters({ ...next, page: DEFAULT_PAGE })} />
        </div>

        {isLoading ? (
          <OrderListLoading />
        ) : isError ? (
          <OrderListError error={error} onRetry={() => void refetch()} />
        ) : orders.length === 0 ? (
          <OrderListEmpty hasFilters={hasAnyFilter} />
        ) : (
          <OrderTable
            orders={orders}
            meta={data?.meta ?? null}
            isRefreshing={isFetching}
            sort={tableSort}
            onPageChange={(page) => changeFilters({ page })}
            onPageSizeChange={(pageSize) => changeFilters({ pageSize, page: DEFAULT_PAGE })}
          />
        )}
      </div>
    </PageContainer>
  );
}
