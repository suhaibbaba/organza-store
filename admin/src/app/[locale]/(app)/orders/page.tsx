"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { HandCoins, Plus } from "lucide-react";
import { can } from "@organza/shared/lib/permissions";
import { DEFAULT_PAGE } from "@organza/shared/constants/pagination";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { DEFAULT_ORDER_FILTERS, ORDER_SEARCH_DEBOUNCE_MS } from "@/constants/orders";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useOrdersQuery } from "@/hooks/use-orders";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { OrderSearch } from "@/components/orders/order-search";
import { OrderSortSelect } from "@/components/orders/order-sort-select";
import { OrderFiltersSheet, type OrderFiltersValue } from "@/components/orders/order-filters-sheet";
import { OrderCard } from "@/components/orders/order-card";
import { OrderTable } from "@/components/orders/order-table";
import { OrderPagination } from "@/components/orders/order-pagination";
import {
  OrderListEmpty,
  OrderListError,
  OrderListLoading,
  OrderListSpinnerOverlay,
} from "@/components/orders/order-list-states";
import type { OrderListFilters } from "@/types/order";

export default function OrdersPage() {
  const t = useTranslations("orders");
  const { user } = useSession();
  const canCreate = can(user, "order.create");
  const canCollect = can(user, "order.markCollected");

  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<OrderListFilters>(DEFAULT_ORDER_FILTERS);
  const debouncedSearch = useDebouncedValue(searchInput, ORDER_SEARCH_DEBOUNCE_MS);

  const effectiveFilters = useMemo<OrderListFilters>(
    () => ({ ...filters, q: debouncedSearch }),
    [filters, debouncedSearch]
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useOrdersQuery(effectiveFilters);

  const filtersValue: OrderFiltersValue = {
    status: filters.status,
    channel: filters.channel,
    paymentStatus: filters.paymentStatus,
    hasQuickSale: filters.hasQuickSale,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };
  const activeFilterCount = [
    filters.status,
    filters.channel,
    filters.paymentStatus,
    filters.hasQuickSale,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length;
  const hasAnyFilter = activeFilterCount > 0 || debouncedSearch.trim().length > 0;

  function updatePage(page: number) {
    setFilters((f) => ({ ...f, page }));
  }

  // Any change to what is being looked at returns to page 1 — otherwise a
  // narrower filter can land on a page that no longer exists.
  function applyFilters(next: OrderFiltersValue) {
    setFilters((f) => ({ ...f, ...next, page: DEFAULT_PAGE }));
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    setFilters((f) => ({ ...f, page: DEFAULT_PAGE }));
  }

  function handleSortChange(sortBy: OrderListFilters["sortBy"], sortDir: OrderListFilters["sortDir"]) {
    setFilters((f) => ({ ...f, sortBy, sortDir, page: DEFAULT_PAGE }));
  }

  const orders = data?.orders ?? [];

  return (
    <PageContainer>
      <PageHeader
        name="orders"
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            {/* Employees may take an order, just not undo one (spec.md "Roles &
                Permissions") — the backend is the real gate (CLAUDE.md rule 5). */}
            {canCreate && (
              <Button asChild size="sm" className="shrink-0" data-test-selector="add-order">
                <Link href="/orders/new">
                  <Plus className="size-4" aria-hidden="true" />
                  {t("newOrder")}
                </Link>
              </Button>
            )}

            {/* The shortest path to "who still owes us money" — the question
                this screen can answer but doesn't lead with. Admin/Manager
                only, since settling up is theirs to do. Still the full width
                of the row on a phone: w-full takes a line of its own inside
                the header's wrap. */}
            {canCollect && (
              <Button asChild variant="outline" className="h-12 w-full justify-start sm:w-auto">
                <Link href="/orders/collection">
                  <HandCoins className="size-5" aria-hidden="true" />
                  {t("collectionLink")}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <OrderSearch value={searchInput} onChange={handleSearchChange} />
          <div className="flex gap-3">
            <div className="flex-1">
              <OrderSortSelect sortBy={filters.sortBy} sortDir={filters.sortDir} onChange={handleSortChange} />
            </div>
            <OrderFiltersSheet value={filtersValue} onApply={applyFilters} activeCount={activeFilterCount} />
          </div>
        </div>

        {isLoading ? (
          <OrderListLoading />
        ) : isError ? (
          <OrderListError error={error} onRetry={() => void refetch()} />
        ) : orders.length === 0 ? (
          <OrderListEmpty hasFilters={hasAnyFilter} />
        ) : (
          <>
            {isFetching && <OrderListSpinnerOverlay />}

            <div className="flex flex-col gap-3 md:hidden">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>

            <div className="hidden md:block">
              <OrderTable orders={orders} />
            </div>

            {data?.meta && <OrderPagination meta={data.meta} onPageChange={updatePage} />}
          </>
        )}
      </div>
    </PageContainer>
  );
}
