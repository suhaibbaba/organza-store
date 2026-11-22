"use client";

import { useLocale, useTranslations } from "next-intl";
import { CircleCheck, Clock, HandCoins } from "lucide-react";
import { Button, useConfirm, useToast, Typography } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { isOrderCollectable } from "@store/shared/lib/orders";
import type { Order } from "@store/shared/types/order";
import { useSession } from "@/components/providers/session-provider";
import { useCollectOrdersMutation } from "@/hooks/use-orders";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { formatDateTime } from "@/lib/format";
import { DetailCard } from "@/components/layout/detail-card";
import { errorMessageKey } from "@/lib/error-message-key";
import { OrderCreditPayments } from "@/components/orders/detail/order-credit-payments";

// Recording a collection is order.markCollected; the backend is the real gate, this only decides whether the button exists.
export function OrderPaymentCard({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.payment");
  if (order.onCredit) {
    return (
      <DetailCard
        icon={order.paymentStatus === "ON_CREDIT" ? Clock : CircleCheck}
        title={t("title")}
        data-testid="order-payment-card"
      >
        <OrderCreditPayments order={order} />
      </DetailCard>
    );
  }
  return <CollectionPayment order={order} />;
}

function CollectionPayment({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.payment");
  const tMenu = useTranslations("orders.rowMenu");
  const locale = useLocale();
  const { user } = useSession();
  const toast = useToast();
  const formatMoney = useMoneyFormatter();
  const mutation = useCollectOrdersMutation();
  const { confirm, dialog } = useConfirm("order-collect-confirm");

  const isPending = order.paymentStatus === "PENDING_COLLECTION";
  const isCollectable = isOrderCollectable(order.status);
  const canCollect = can(user, "order.markCollected") && isPending && isCollectable;

  function requestCollect() {
    confirm({
      title: "orders.rowMenu.confirmTitle",
      titleValues: { number: order.orderNumber },
      consequences: [tMenu("confirmConsequence", { amount: formatMoney(order.total) })],
      confirmLabel: "orders.rowMenu.confirmAction",
      tone: "primary",
      onConfirm: async () => {
        try {
          await mutation.mutateAsync([order.id]);
          toast.success("orders.detail.payment.markedCollected");
        } catch (error) {
          toast.error(errorMessageKey(error));
          throw error;
        }
      },
    });
  }

  return (
    <DetailCard icon={isPending ? HandCoins : CircleCheck} title={t("title")} data-testid="order-payment-card">
      <Typography variant="body" className="rounded-panel bg-sunken px-4 py-3">
        {!isPending
          ? t("collectedOn", { date: order.collectedAt ? formatDateTime(order.collectedAt, locale) : "—" })
          : isCollectable
            ? t("pendingExplainer", { amount: formatMoney(order.total) })
            : t("nothingToCollect")}
      </Typography>
      {canCollect && (
        <Button
          className="w-full"
          onClick={requestCollect}
          data-test-selector="order-mark-collected"
          icon={<HandCoins className="size-4" aria-hidden="true" />}
        >
          {t("markCollected")}
        </Button>
      )}
      {dialog}
    </DetailCard>
  );
}
