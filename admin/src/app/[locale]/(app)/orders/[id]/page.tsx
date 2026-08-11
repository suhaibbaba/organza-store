"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { can } from "@organza/shared/lib/permissions";
import { ONLINE_ORDER_CHANNELS } from "@organza/shared/constants/order";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useOrderQuery } from "@/hooks/use-orders";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
          <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
          <div className="h-56 animate-pulse rounded-xl bg-muted" />
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
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <ReceiptText className="size-10 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">{t("notFoundTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("notFoundDescription")}</p>
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  const isOnline = (ONLINE_ORDER_CHANNELS as readonly string[]).includes(order.channel);
  // An Employee can move an order along but not undo one — said plainly, so
  // a missing button doesn't read as a broken screen (spec.md "Roles &
  // Permissions").
  const canManage = can(user, "order.return") || can(user, "order.delete") || can(user, "order.cancel");

  return (
    <PageContainer>
      {/* Above the header, not inside it: this is the way out of the screen,
          not one of its actions. */}
      <div className="mb-4">
        <BackLink label={t("back")} />
      </div>

      <PageHeader
        className="mb-3"
        title={tCard("orderNumber", { number: String(order.orderNumber) })}
        actions={<p className="text-xl font-bold tabular-nums">{formatMoney(order.total)}</p>}
      />

      <div className="flex flex-col gap-4">
        {/* Under the header rather than inside it: three badges are a row of
            their own, not a sentence PageHeader's description could hold. */}
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <OrderChannelBadge channel={order.channel} />
          {/* Renders nothing for an ordinary sale. On a gift it is what
              explains the 0.00 beside it. */}
          <OrderTypeBadge type={order.type} />
        </div>

        {/* Advancing the delivery flow is the reason this screen is opened, so
            it sits above the detail rather than under it — reachable by thumb
            without scrolling on a phone. */}
        <OrderStatusActions order={order} />

        {/* Where the money is, right under where the goods are: the two
            together are what the shop actually asks about an order. */}
        <OrderPaymentCard order={order} />

        {/* A STORE sale has no customer to show: it was handed over the counter
            (spec.md "Customer information"). */}
        {isOnline && <OrderCustomerCard order={order} />}

        <OrderItemsList items={order.items} />
        <OrderTotalsCard order={order} />
        <OrderMetaCard order={order} />

        {canManage ? <OrderManageActions order={order} /> : <Alert>{t("manage.noPermission")}</Alert>}
      </div>
    </PageContainer>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="-ms-2 self-start px-2">
      <Link href="/orders">
        {/* Points back in the reading direction — leftward only in LTR. */}
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        {label}
      </Link>
    </Button>
  );
}
