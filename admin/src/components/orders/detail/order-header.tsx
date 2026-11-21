"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Coins, CreditCard, ShoppingCart, Undo2, UserRound } from "lucide-react";
import { Button, MenuItem, RowMenu, useConfirm, useToast, Typography } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { isOrderCollectable } from "@store/shared/lib/orders";
import { ORDER_STATUS_TRANSITIONS, RETURNABLE_ORDER_STATUSES } from "@store/shared/constants/order";
import type { Order } from "@store/shared/types/order";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { useDeleteOrderMutation, useUpdateOrderStatusMutation } from "@/hooks/use-orders";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useActorName } from "@/lib/user-display";
import { OrderChannelBadge } from "@/components/orders/order-channel-badge";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderTypeBadge } from "@/components/orders/order-type-badge";
import { QuickSaleBadge } from "@/components/orders/quick-sale-badge";
import { PaymentStatusBadge } from "@/components/orders/payment-status-badge";
import { OrderReturnSheet } from "@/components/orders/detail/order-return-sheet";
import { errorMessageKey } from "@/lib/error-message-key";

// Anti-theft (spec.md): whoever rang an order up must not undo it, so return/cancel/delete are permission-gated.
export function OrderHeader({ order }: { order: Order }) {
  const t = useTranslations("orders");
  const locale = useLocale();
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const formatMoney = useMoneyFormatter();
  const actorName = useActorName();
  const statusMutation = useUpdateOrderStatusMutation(order.id);
  const deleteMutation = useDeleteOrderMutation(order.id);
  const cancelConfirm = useConfirm("order-cancel-confirm");
  const deleteConfirm = useConfirm("order-delete-confirm");
  const [returnOpen, setReturnOpen] = useState(false);

  const canReturn =
    can(user, "order.return") && (RETURNABLE_ORDER_STATUSES as readonly string[]).includes(order.status);
  const canCancel = (ORDER_STATUS_TRANSITIONS[order.status] ?? []).includes("CANCELLED") && can(user, "order.cancel");
  const canDelete = can(user, "order.delete");
  const hasQuickSale = order.hasQuickSale || order.items.some((item) => item.quickSold);

  function requestCancel() {
    cancelConfirm.confirm({
      title: "orders.detail.statusActions.cancelTitle",
      titleValues: { number: order.orderNumber },
      consequences: [
        t(
          order.stockDeductedAt
            ? "detail.statusActions.cancelConsequenceStock"
            : "detail.statusActions.cancelConsequence",
        ),
      ],
      confirmLabel: "orders.detail.statusActions.cancelOrder",
      tone: "danger",
      onConfirm: async () => {
        try {
          await statusMutation.mutateAsync("CANCELLED");
          toast.success("orders.detail.statusActions.cancelled");
        } catch (error) {
          toast.error(errorMessageKey(error));
          throw error;
        }
      },
    });
  }

  function requestDelete() {
    deleteConfirm.confirm({
      title: "orders.detail.manage.deleteTitle",
      titleValues: { number: order.orderNumber },
      consequences: [
        t(order.stockDeductedAt ? "detail.manage.deleteConsequenceStock" : "detail.manage.deleteConsequence"),
      ],
      confirmLabel: "orders.detail.manage.deleteOrder",
      tone: "danger",
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync();
          toast.success("orders.detail.manage.deleted");
          router.replace("/orders");
        } catch (error) {
          toast.error(errorMessageKey(error));
          throw error;
        }
      },
    });
  }

  const facts = [
    { key: "date", icon: CalendarDays, label: t("detail.header.date"), value: formatDateTime(order.createdAt, locale) },
    {
      key: "createdBy",
      icon: UserRound,
      label: t("detail.meta.createdBy"),
      value: actorName(order.createdBy, t("detail.meta.unknownStaff")),
    },
    {
      key: "paymentMethod",
      icon: CreditCard,
      label: t("detail.totals.paymentMethod"),
      value: t(`payment.${order.paymentMethod}`),
    },
    { key: "total", icon: Coins, label: t("detail.totals.total"), value: formatMoney(order.total) },
  ];

  return (
    <header className="rounded-card border border-line bg-surface p-5 shadow-card" data-test-selector="order-header">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-panel bg-primary-50 text-primary-700">
            <ShoppingCart className="size-6" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-col gap-2.5">
            <Typography variant="h1" weight="semibold" className="truncate">
              {t("card.orderNumber", { number: String(order.orderNumber) })}
            </Typography>
            <div className="flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={order.status} />
              <OrderChannelBadge channel={order.channel} />
              {/* No payment badge on a cancelled/returned sale: it would state a debt that doesn't exist. */}
              {(order.paymentStatus === "COLLECTED" || isOrderCollectable(order.status)) && (
                <PaymentStatusBadge status={order.paymentStatus} />
              )}
              <OrderTypeBadge type={order.type} />
              {hasQuickSale && <QuickSaleBadge />}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canReturn && (
            <Button
              variant="secondary"
              onClick={() => setReturnOpen(true)}
              data-test-selector="order-return"
              icon={<Undo2 className="size-4 rtl:-scale-x-100" aria-hidden="true" />}
            >
              {t("detail.manage.returnItems")}
            </Button>
          )}
          {(canCancel || canDelete) && (
            <RowMenu size="target" data-testid="order-actions-menu" label={t("detail.header.options")}>
              {canCancel && (
                <MenuItem icon="x" tone="danger" data-testid="order-cancel" onSelect={requestCancel}>
                  {t("detail.statusActions.cancelOrder")}
                </MenuItem>
              )}
              {canDelete && (
                <MenuItem icon="trash" tone="danger" data-testid="order-delete" onSelect={requestDelete}>
                  {t("detail.manage.deleteOrder")}
                </MenuItem>
              )}
            </RowMenu>
          )}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 overflow-hidden rounded-panel border border-line bg-sunken lg:grid-cols-4">
        {facts.map((fact, index) => {
          const isTotal = fact.key === "total";
          return (
            <div
              key={fact.key}
              data-test-selector={`order-fact-${fact.key}`}
              className={cn(
                "flex min-w-0 flex-col items-start gap-2 border-line px-4 py-3.5 sm:flex-row sm:gap-3 sm:px-5 sm:py-4",
                index % 2 === 1 && "border-s",
                index >= 2 && "border-t lg:border-t-0",
                index === 2 && "lg:border-s",
                isTotal && "bg-primary-50",
              )}
            >
              <fact.icon className="mt-0.5 size-5 shrink-0 text-primary-700" aria-hidden="true" />
              <div className="min-w-0">
                <Typography variant="small" tone="muted" as="dt">
                  {fact.label}
                </Typography>
                <Typography
                  as="dd"
                  variant={isTotal ? "h2" : "body"}
                  weight={isTotal ? "semibold" : undefined}
                  className={cn("mt-1 tabular-nums", isTotal && "text-primary-900")}
                >
                  {fact.value}
                </Typography>
              </div>
            </div>
          );
        })}
      </dl>

      {cancelConfirm.dialog}
      {deleteConfirm.dialog}
      {canReturn && <OrderReturnSheet order={order} open={returnOpen} onOpenChange={setReturnOpen} />}
    </header>
  );
}
