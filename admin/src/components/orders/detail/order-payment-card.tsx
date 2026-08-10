"use client";

import { useLocale, useTranslations } from "next-intl";
import { Check, HandCoins } from "lucide-react";
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
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { PaymentStatusBadge } from "@/components/orders/payment-status-badge";

// Where this order's money is (spec.md "Payment collection"). Separate from
// the status card above it, because "the parcel has gone" and "we have been
// paid" are different facts and the shop needs to read them apart.
//
// Recording a collection is Admin/Manager only (order.markCollected) — the
// backend is the real gate; this only decides whether the button exists.
export function OrderPaymentCard({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.payment");
  const locale = useLocale();
  const { user } = useSession();
  const formatMoney = useMoneyFormatter();
  const translateError = useTranslateError();
  const mutation = useCollectOrdersMutation();

  const isPending = order.paymentStatus === "PENDING_COLLECTION";
  // A cancelled or fully returned sale owes nothing, so there is nothing to
  // collect on it — the button would only lead to a 409.
  const isCollectable = isOrderCollectable(order.status);
  const canCollect = can(user, "order.markCollected") && isPending && isCollectable;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">{t("title")}</span>
          {/* A cancelled or returned sale is technically uncollected, but
              badging it "awaiting payment" would state a debt that doesn't
              exist — the line below says what is actually true instead. */}
          {(!isPending || isCollectable) && <PaymentStatusBadge status={order.paymentStatus} />}
        </div>

        <p className="text-sm text-foreground">
          {!isPending
            ? t("collectedOn", {
                date: order.collectedAt ? formatDateTime(order.collectedAt, locale) : "—",
              })
            : isCollectable
              ? t("pendingExplainer", { amount: formatMoney(order.total) })
              : // Cancelled or returned: never collected, but nothing is owed
                // either — saying "still with the delivery company" here would
                // invent a debt.
                t("nothingToCollect")}
        </p>

        {mutation.isError && (
          <Alert variant="destructive">
            {translateError(mutation.error instanceof ApiError ? mutation.error.code : ERROR_CODES.INTERNAL)}
          </Alert>
        )}

        {mutation.isSuccess && !mutation.isPending && !isPending && (
          <Alert variant="success">
            <Check className="size-4 shrink-0" aria-hidden="true" />
            {t("markedCollected")}
          </Alert>
        )}

        {canCollect && (
          <Button
            type="button"
            className="h-14 w-full text-base sm:w-auto sm:self-start"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate([order.id])}
          >
            {mutation.isPending ? <Spinner /> : <HandCoins className="size-5" aria-hidden="true" />}
            {t("markCollected")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
