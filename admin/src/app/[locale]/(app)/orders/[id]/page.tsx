"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { can } from "@organza/shared/lib/permissions";
import { ONLINE_ORDER_CHANNELS } from "@organza/shared/constants/order";
import { useSession } from "@/components/providers/session-provider";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { useOrderQuery } from "@/hooks/use-orders";
import { ApiError } from "@/lib/api/errors";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { Alert, EmptyState, Skeleton } from "@store/ui";
import { OrderListError } from "@/components/orders/order-list-states";
import { OrderItemsList } from "@/components/orders/detail/order-items-list";
import { OrderTotals } from "@/components/orders/detail/order-totals-card";
import { OrderCustomerCard } from "@/components/orders/detail/order-customer-card";
import { OrderMetaCard } from "@/components/orders/detail/order-meta-card";
import { OrderStatusActions } from "@/components/orders/detail/order-status-actions";
import { OrderPaymentCard } from "@/components/orders/detail/order-payment-card";
import { OrderHeader } from "@/components/orders/detail/order-header";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <RoleGuard action="order.view">
      <OrderDetailPageContent params={params} />
    </RoleGuard>
  );
}

function OrderDetailPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("orders.detail");
  const { user } = useSession();

  const { data: order, isLoading, isError, error, refetch } = useOrderQuery(id);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-40 rounded-control" />
          <Skeleton className="h-40 rounded-card" />
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

  const isOnline = (ONLINE_ORDER_CHANNELS as readonly string[]).includes(order.channel);
  // An Employee can move an order along but not undo one; said plainly so a missing button doesn't look broken.
  const canManage = can(user, "order.return") || can(user, "order.delete") || can(user, "order.cancel");

  return (
    <PageContainer>
      <div className="flex flex-col gap-5">
        <OrderHeader order={order} />

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <OrderItemsList items={order.items} footer={<OrderTotals order={order} />} />
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <OrderStatusActions order={order} />
            <OrderPaymentCard order={order} />
            {/* A STORE sale was handed over the counter: no customer to show. */}
            {isOnline && <OrderCustomerCard order={order} />}
            <OrderMetaCard order={order} />
            {!canManage && (
              <Alert tone="info" data-testid="alert-default">
                {t("manage.noPermission")}
              </Alert>
            )}
          </aside>
        </div>
      </div>
    </PageContainer>
  );
}

