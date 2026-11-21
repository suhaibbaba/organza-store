"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { DEFAULT_PAGE } from "@organza/shared/constants/pagination";
import { Link } from "@/i18n/navigation";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { COLLECTION_ORDER_FILTERS } from "@/constants/orders";
import { useCollectOrdersMutation, useCollectionSummaryQuery, useOrdersQuery } from "@/hooks/use-orders";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { Alert, Button, buttonClassName, EmptyState } from "@store/ui";
import { OrderListError, OrderListLoading, OrderListSpinnerOverlay } from "@/components/orders/order-list-states";
import { OrderPagination } from "@/components/orders/order-pagination";
import { CollectionSummaryCard } from "@/components/orders/collection/collection-summary-card";
import { CollectionOrderRow } from "@/components/orders/collection/collection-order-row";
import { CollectionActionBar } from "@/components/orders/collection/collection-action-bar";
import type { OrderListFilters } from "@/types/order";

// Unpaid sales oldest first, to tick off as settled. Gated on order.markCollected: the shop-wide total is refused to an Employee (rule 19).
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

  // Only what is on screen counts: a page-1 selection must never be settled from page 2.
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
        // Settled orders leave the list, which can empty this page.
        setFilters((f) => ({ ...f, page: DEFAULT_PAGE }));
      },
    });
  }

  const allOnPageSelected = orders.length > 0 && selectedOnPage.length === orders.length;

  return (
    <PageContainer>
      {/* Above the header: the way out of the screen, not one of its actions. */}
      <Link
        href="/orders"
        data-test-selector="back-link"
        className={buttonClassName({ variant: "quiet", className: "-ms-2 mb-4 self-start px-2" })}
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        {t("back")}
      </Link>

      <PageHeader name="collection" title={t("title")} description={t("subtitle")} />

      <div className="flex flex-col gap-4">
        {summaryQuery.data && <CollectionSummaryCard summary={summaryQuery.data} />}

        {mutation.isError && (
          <Alert tone="danger" data-testid="alert-destructive">
            {translateError(mutation.error instanceof ApiError ? mutation.error.code : ERROR_CODES.INTERNAL)}
          </Alert>
        )}

        {mutation.isSuccess && !mutation.isPending && (
          <Alert tone="success" data-testid="alert-success">
            {t("marked", { count: mutation.data.collectedIds.length })}
          </Alert>
        )}

        {isLoading ? (
          <OrderListLoading />
        ) : isError ? (
          <OrderListError error={error} onRetry={() => void refetch()} />
        ) : orders.length === 0 ? (
          <EmptyState
            data-testid="collection-empty"
            icon="coins"
            title="orders.collection.empty.title"
            hint="orders.collection.empty.description"
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-label text-ink-muted">{t("listLabel")}</span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => (allOnPageSelected ? setSelectedIds([]) : selectAllOnPage())}
              >
                {allOnPageSelected ? t("actions.clear") : t("actions.selectAll")}
              </Button>
            </div>

            {isFetching && <OrderListSpinnerOverlay />}

            {/* Several across on a desk, so the whole batch is visible while being ticked. */}
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

            {/* Room for the fixed action bar over the last row. */}
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
