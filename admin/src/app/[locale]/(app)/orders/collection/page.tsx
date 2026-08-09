"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check, HandCoins } from "lucide-react";
import { ERROR_CODES } from "@shared/constants/errors";
import { DEFAULT_PAGE } from "@shared/constants/pagination";
import { Link } from "@/i18n/navigation";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { COLLECTION_ORDER_FILTERS } from "@/constants/orders";
import { useCollectOrdersMutation, useCollectionSummaryQuery, useOrdersQuery } from "@/hooks/use-orders";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OrderListError, OrderListLoading, OrderListSpinnerOverlay } from "@/components/orders/order-list-states";
import { OrderPagination } from "@/components/orders/order-pagination";
import { CollectionSummaryCard } from "@/components/orders/collection/collection-summary-card";
import { CollectionOrderRow } from "@/components/orders/collection/collection-order-row";
import { CollectionActionBar } from "@/components/orders/collection/collection-action-bar";
import type { OrderListFilters } from "@/types/order";

// "Money with the delivery company" (spec.md "Payment collection").
//
// One question, one screen: which sales has the shop not been paid for, how
// much is that in total, and tick off the ones that have just been settled.
// Oldest first, because the money owed longest is the money to chase.
//
// Admin/Manager only, on the permission that lets somebody settle the money:
// the total here is every unpaid sale in the shop added up, which the backend
// refuses an Employee outright (GET /api/orders/collection-summary).
export default function OrderCollectionPage() {
  return (
    <RoleGuard action="order.markCollected">
      <OrderCollectionPageContent />
    </RoleGuard>
  );
}

function OrderCollectionPageContent() {
  const t = useTranslations("orders.collection");
  const translateError = useTranslateError();

  const [filters, setFilters] = useState<OrderListFilters>(COLLECTION_ORDER_FILTERS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data, isLoading, isFetching, isError, error, refetch } = useOrdersQuery(filters);
  const summaryQuery = useCollectionSummaryQuery();
  const mutation = useCollectOrdersMutation();

  const orders = useMemo(() => data?.orders ?? [], [data]);

  // What is ticked, out of what is currently on screen: a selection made on
  // page 1 must not be settled invisibly after paging to page 2.
  const selectedOnPage = useMemo(
    () => orders.filter((order) => selectedIds.includes(order.id)),
    [orders, selectedIds]
  );
  const selectedAmount = selectedOnPage
    .reduce((sum, order) => sum + Number(order.total), 0)
    .toFixed(2);

  function toggle(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((one) => one !== id) : [...ids, id]));
  }

  function changePage(page: number) {
    // Paging clears the selection for the same reason the totals above only
    // count this page: nobody should settle orders they can no longer see.
    setSelectedIds([]);
    setFilters((f) => ({ ...f, page }));
  }

  function selectAllOnPage() {
    setSelectedIds(orders.map((order) => order.id));
  }

  function confirm() {
    mutation.mutate(selectedOnPage.map((order) => order.id), {
      onSuccess: () => {
        setSelectedIds([]);
        // The settled orders leave this list, which can empty the page —
        // step back rather than stranding the user on a blank one.
        setFilters((f) => ({ ...f, page: DEFAULT_PAGE }));
      },
    });
  }

  const allOnPageSelected = orders.length > 0 && selectedOnPage.length === orders.length;

  return (
    <PageContainer>
      {/* Above the header, not inside it: this is the way out of the screen,
          not one of its actions. */}
      <Button asChild variant="ghost" size="sm" className="-ms-2 mb-4 self-start px-2">
        <Link href="/orders">
          {/* Points back in the reading direction — leftward only in LTR. */}
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
          {t("back")}
        </Link>
      </Button>

      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="flex flex-col gap-4">
        {summaryQuery.data && <CollectionSummaryCard summary={summaryQuery.data} />}

        {mutation.isError && (
          <Alert variant="destructive">
            {translateError(mutation.error instanceof ApiError ? mutation.error.code : ERROR_CODES.INTERNAL)}
          </Alert>
        )}

        {mutation.isSuccess && !mutation.isPending && (
          <Alert variant="success">
            <Check className="size-4 shrink-0" aria-hidden="true" />
            {t("marked", { count: mutation.data.collectedIds.length })}
          </Alert>
        )}

        {isLoading ? (
          <OrderListLoading />
        ) : isError ? (
          <OrderListError error={error} onRetry={() => void refetch()} />
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <HandCoins className="size-10 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">{t("empty.title")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("empty.description")}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{t("listLabel")}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => (allOnPageSelected ? setSelectedIds([]) : selectAllOnPage())}
              >
                {allOnPageSelected ? t("actions.clear") : t("actions.selectAll")}
              </Button>
            </div>

            {isFetching && <OrderListSpinnerOverlay />}

            {/* Ticking off a batch: an order number, a date and an amount per
                row. Several across on a desk screen means the whole batch is
                visible while it is being ticked. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {orders.map((order) => (
                <CollectionOrderRow
                  key={order.id}
                  order={order}
                  selected={selectedIds.includes(order.id)}
                  onToggle={toggle}
                />
              ))}
            </div>

            {data?.meta && <OrderPagination meta={data.meta} onPageChange={changePage} />}

            {/* Room for the fixed action bar, so the last row is never stuck
                underneath it. */}
            {selectedOnPage.length > 0 && <div className="h-32" aria-hidden="true" />}
          </>
        )}

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
