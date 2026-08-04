"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { can } from "@shared/lib/permissions";
import { DEFAULT_PAGE } from "@shared/constants/pagination";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { DEFAULT_ORDER_FILTERS, ORDER_SEARCH_DEBOUNCE_MS } from "@/constants/orders";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useOrdersQuery } from "@/hooks/use-orders";
import { Button } from "@/components/ui/button";
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
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };
  const activeFilterCount = [filters.status, filters.channel, filters.dateFrom, filters.dateTo].filter(Boolean).length;
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
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {/* Employees may take an order, just not undo one (spec.md "Roles &
            Permissions") — the backend is the real gate (CLAUDE.md rule 5). */}
        {canCreate && (
          <Button asChild size="sm" className="shrink-0">
            <Link href="/orders/new">
              <Plus className="size-4" aria-hidden="true" />
              {t("newOrder")}
            </Link>
          </Button>
        )}
      </div>

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
  );
}
