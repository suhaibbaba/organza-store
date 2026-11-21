"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { can } from "@organza/shared/lib/permissions";
import { ONLINE_ORDER_CHANNELS } from "@organza/shared/constants/order";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useOrderQuery } from "@/hooks/use-orders";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Alert, buttonClassName, EmptyState, Skeleton } from "@store/ui";
import { OrderChannelBadge } from "@/components/orders/order-channel-badge";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderTypeBadge } from "@/components/orders/order-type-badge";
import { OrderListError } from "@/components/orders/order-list-states";
import { OrderItemsList } from "@/components/orders/detail/order-items-list";
import { OrderTotalsCard } from "@/components/orders/detail/order-totals-card";
import { OrderCustomerCard } from "@/components/orders/detail/order-customer-card";
import { OrderMetaCard } from "@/components/orders/detail/order-meta-card";
import { OrderStatusActions } from "@/components/orders/detail/order-status-actions";
import { OrderPaymentCard } from "@/components/orders/detail/order-payment-card";
import { OrderManageActions } from "@/components/orders/detail/order-manage-actions";

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
  const tCard = useTranslations("orders.card");
  const { user } = useSession();
  const formatMoney = useMoneyFormatter();

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

  if (isError) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-4">
          <BackLink label={t("back")} />
          <OrderListError error={error} onRetry={() => void refetch()} />
        </div>
      </PageContainer>
    );
  }

  if (!order) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-4">
          <BackLink label={t("back")} />
          <EmptyState
            data-testid="order-not-found"
            icon="receipt"
            title="orders.detail.notFoundTitle"
            hint="orders.detail.notFoundDescription"
          />
        </div>
      </PageContainer>
    );
  }

  const isOnline = (ONLINE_ORDER_CHANNELS as readonly string[]).includes(order.channel);
  // An Employee can move an order along but not undo one; said plainly so a missing button doesn't look broken.
  const canManage = can(user, "order.return") || can(user, "order.delete") || can(user, "order.cancel");

  return (
    <PageContainer>
      <div className="mb-4">
        <BackLink label={t("back")} />
      </div>
      <PageHeader
        name="order-detail"
        className="mb-3"
        title={tCard("orderNumber", { number: String(order.orderNumber) })}
        actions={<p className="text-heading font-bold tabular-nums text-ink">{formatMoney(order.total)}</p>}
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <OrderChannelBadge channel={order.channel} />
          {/* Only on a gift, where it explains the 0.00. */}
          <OrderTypeBadge type={order.type} />
        </div>

        {/* Advancing the flow is why this screen is opened, so it sits within thumb reach. */}
        <OrderStatusActions order={order} />

        <OrderPaymentCard order={order} />

        {/* A STORE sale was handed over the counter: no customer to show. */}
        {isOnline && <OrderCustomerCard order={order} />}

        <OrderItemsList items={order.items} />
        <OrderTotalsCard order={order} />
        <OrderMetaCard order={order} />

        {canManage ? <OrderManageActions order={order} /> : <Alert tone="info" data-testid="alert-default">{t("manage.noPermission")}</Alert>}
      </div>
    </PageContainer>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/orders"
      data-test-selector="back-link"
      className={buttonClassName({ variant: "quiet", className: "-ms-2 self-start px-2" })}
    >
      <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
      {label}
    </Link>
  );
}
