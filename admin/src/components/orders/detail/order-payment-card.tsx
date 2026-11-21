"use client";

import { useLocale, useTranslations } from "next-intl";
import { CircleCheck, HandCoins } from "lucide-react";
import { Button, useConfirm, useToast, Typography } from "@store/ui";
import { can } from "@organza/shared/lib/permissions";
import { isOrderCollectable } from "@organza/shared/lib/orders";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import type { Order } from "@organza/shared/types/order";
import { useSession } from "@/components/providers/session-provider";
import { useCollectOrdersMutation } from "@/hooks/use-orders";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { DetailCard } from "@/components/layout/detail-card";

// Recording a collection is order.markCollected; the backend is the real gate, this only decides whether the button exists.
export function OrderPaymentCard({ order }: { order: Order }) {
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
          toast.error(error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL);
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
