"use client";

import { useTranslations } from "next-intl";
import { HandCoins, Plus } from "lucide-react";
import { SearchField, TotalBadge, buttonClassName, type TableSort } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { DEFAULT_PAGE } from "@store/shared/constants/pagination";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { DEFAULT_ORDER_FILTERS, ORDER_LIST_URL_PARAMS, ORDER_SEARCH_DEBOUNCE_MS } from "@/constants/orders";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useUrlSearch } from "@/hooks/use-url-search";
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

  const [filters, changeFilters] = useUrlFilters(DEFAULT_ORDER_FILTERS, ORDER_LIST_URL_PARAMS);
  const [searchInput, setSearchInput] = useUrlSearch(
    filters.q,
    (q) => changeFilters({ q, page: DEFAULT_PAGE }),
    ORDER_SEARCH_DEBOUNCE_MS,
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useOrdersQuery(filters);
  const orders = data?.orders ?? [];

  const filtersValue: OrderFiltersValue = {
    status: filters.status,
    channel: filters.channel,
    paymentStatus: filters.paymentStatus,
    hasQuickSale: filters.hasQuickSale,
    isExchange: filters.isExchange,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };
  const sortValue: OrderSortValue = { sortBy: filters.sortBy, sortDir: filters.sortDir };
  const hasAnyFilter = countOrderFilters(filtersValue) > 0 || filters.q.trim().length > 0;

  const tableSort: TableSort = {
    key: filters.sortBy,
    dir: filters.sortDir,
    onChange: (key, dir) =>
      changeFilters(
        key === null
          ? { sortBy: DEFAULT_ORDER_FILTERS.sortBy, sortDir: DEFAULT_ORDER_FILTERS.sortDir, page: DEFAULT_PAGE }
          : { sortBy: key as OrderListFilters["sortBy"], sortDir: dir, page: DEFAULT_PAGE },
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
                onChange={(e) => setSearchInput(e.target.value)}
                onClear={() => setSearchInput("")}
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
              <div className="ms-auto flex h-(--control-h) items-center">
                <TotalBadge data-testid="orders-count" total={data.meta.total} />
              </div>
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
