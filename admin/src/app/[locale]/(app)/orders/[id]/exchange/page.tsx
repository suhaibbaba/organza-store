"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { Alert, EmptyState, Skeleton } from "@store/ui";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { OrderListError } from "@/components/orders/order-list-states";
import { ExchangeBuilder } from "@/components/orders/exchange/exchange-builder";
import { useOrderQuery } from "@/hooks/use-orders";
import { ApiError } from "@/lib/api/errors";
import { isOrderExchangeable } from "@/lib/order-exchange";

export default function OrderExchangePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    // UI convenience only; the backend refuses the exchange regardless (rule 5).
    <RoleGuard action="order.exchange">
      <OrderExchangePageContent params={params} />
    </RoleGuard>
  );
}

function OrderExchangePageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("orders.exchange");
  const { data: order, isLoading, isError, error, refetch } = useOrderQuery(id);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-40 rounded-control" />
          <Skeleton className="h-56 rounded-card" />
        </div>
      </PageContainer>
    );
  }

  if (isError && !(error instanceof ApiError && error.code === ERROR_CODES.ORDER_NOT_FOUND)) {
    return (
      <PageContainer>
        <OrderListError error={error} onRetry={() => void refetch()} />
      </PageContainer>
    );
  }

  if (!order) {
    return (
      <PageContainer>
        <EmptyState
          data-testid="order-not-found"
          icon="receipt"
          title="orders.detail.notFoundTitle"
          hint="orders.detail.notFoundDescription"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader name="order-exchange" title={t("title", { number: order.orderNumber })} description={t("subtitle")} />
      {isOrderExchangeable(order) ? (
        // Keyed by order so a half-built exchange never carries over to another sale.
        <ExchangeBuilder key={order.id} order={order} />
      ) : (
        <Alert tone="neutral" data-testid="exchange-not-possible">
          {t("notPossible")}
        </Alert>
      )}
    </PageContainer>
  );
}
