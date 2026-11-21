"use client";

import { useLocale, useTranslations } from "next-intl";
import { HandCoins } from "lucide-react";
import { Alert, Button, Card } from "@store/ui";
import { can } from "@organza/shared/lib/permissions";
import { isOrderCollectable } from "@organza/shared/lib/orders";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import type { Order } from "@organza/shared/types/order";
import { useSession } from "@/components/providers/session-provider";
import { useCollectOrdersMutation } from "@/hooks/use-orders";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { PaymentStatusBadge } from "@/components/orders/payment-status-badge";

// Recording a collection is order.markCollected; the backend is the real gate, this only decides whether the button exists.
export function OrderPaymentCard({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.payment");
  const locale = useLocale();
  const { user } = useSession();
  const formatMoney = useMoneyFormatter();
  const translateError = useTranslateError();
  const mutation = useCollectOrdersMutation();

  const isPending = order.paymentStatus === "PENDING_COLLECTION";
  // A cancelled or fully returned sale owes nothing; collecting it would only 409.
  const isCollectable = isOrderCollectable(order.status);
  const canCollect = can(user, "order.markCollected") && isPending && isCollectable;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-label text-ink-muted">{t("title")}</span>
        {/* No "awaiting payment" badge on a cancelled/returned sale: it would state a debt that doesn't exist. */}
        {(!isPending || isCollectable) && <PaymentStatusBadge status={order.paymentStatus} />}
      </div>

      <p className="text-label text-ink">
        {!isPending
          ? t("collectedOn", {
              date: order.collectedAt ? formatDateTime(order.collectedAt, locale) : "—",
            })
          : isCollectable
            ? t("pendingExplainer", { amount: formatMoney(order.total) })
            : t("nothingToCollect")}
      </p>

      {mutation.isError && (
        <Alert tone="danger" data-testid="alert-destructive">
          {translateError(mutation.error instanceof ApiError ? mutation.error.code : ERROR_CODES.INTERNAL)}
        </Alert>
      )}

      {mutation.isSuccess && !mutation.isPending && !isPending && (
        <Alert tone="success" data-testid="alert-success">
          {t("markedCollected")}
        </Alert>
      )}

      {canCollect && (
        <Button
          type="button"
          className="w-full sm:w-auto sm:self-start"
          isLoading={mutation.isPending}
          onClick={() => mutation.mutate([order.id])}
          icon={<HandCoins className="size-5" aria-hidden="true" />}
        >
          {t("markCollected")}
        </Button>
      )}
    </Card>
  );
}
