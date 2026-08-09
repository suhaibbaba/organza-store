"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, PackageMinus, XCircle } from "lucide-react";
import { can } from "@shared/lib/permissions";
import { ERROR_CODES } from "@shared/constants/errors";
import { ONLINE_STOCK_DEDUCTION_STATUS, ORDER_STATUS_TRANSITIONS } from "@shared/constants/order";
import type { Order, OrderStatus } from "@shared/types/order";
import { ONLINE_ORDER_FLOW } from "@/constants/orders";
import { useSession } from "@/components/providers/session-provider";
import { useUpdateOrderStatusMutation } from "@/hooks/use-orders";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// Moving an order along the delivery flow. The only moves offered are the
// ones ORDER_STATUS_TRANSITIONS allows from where the order is now — the same
// table the backend validates against (CLAUDE.md rule 5: the backend is the
// gate, this just decides which buttons exist).
//
// RETURNED is reachable in that table but never settable here: it has to come
// from the returns action so stock and returnedQuantity move together.
export function OrderStatusActions({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.statusActions");
  const tStatus = useTranslations("orders.status");
  const { user } = useSession();
  const translateError = useTranslateError();
  const mutation = useUpdateOrderStatusMutation(order.id);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const allowed = ORDER_STATUS_TRANSITIONS[order.status] ?? [];
  // Forward moves only — cancelling has its own button below, and RETURNED is
  // not settable through this endpoint.
  const forwardStatuses = allowed.filter((status) => status !== "CANCELLED" && status !== "RETURNED");
  const canCancel = allowed.includes("CANCELLED") && can(user, "order.cancel");

  // Where this order sits in the online pipeline. -1 for a STORE sale, which
  // never enters it (it opens COMPLETED), and for a cancelled/returned order,
  // whose place in the flow no longer means anything.
  const currentStep = ONLINE_ORDER_FLOW.indexOf(order.status as (typeof ONLINE_ORDER_FLOW)[number]);
  const showFlow = currentStep !== -1;

  function move(status: OrderStatus) {
    setConfirmingCancel(false);
    mutation.mutate(status);
  }

  // Nothing left to do to this order — no buttons, and no empty card either.
  if (!showFlow && forwardStatuses.length === 0 && !canCancel) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        {showFlow && (
          <ol className="flex items-center gap-1" aria-label={t("progressLabel")}>
            {ONLINE_ORDER_FLOW.map((status, index) => {
              const isDone = index < currentStep;
              const isCurrent = index === currentStep;
              return (
                <li key={status} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div
                    className={cn(
                      "flex h-2 w-full rounded-full",
                      isDone || isCurrent ? "bg-primary" : "bg-muted"
                    )}
                  />
                  <span
                    className={cn(
                      "truncate text-center text-[11px] leading-tight",
                      isCurrent ? "font-semibold text-primary" : "text-muted-foreground"
                    )}
                  >
                    {tStatus(status)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {mutation.isError && (
          <Alert variant="destructive">
            {translateError(mutation.error instanceof ApiError ? mutation.error.code : ERROR_CODES.INTERNAL)}
          </Alert>
        )}

        {mutation.isSuccess && !mutation.isPending && (
          <Alert variant="success">
            <Check className="size-4 shrink-0" aria-hidden="true" />
            {t("moved", { status: tStatus(order.status) })}
          </Alert>
        )}

        {forwardStatuses.map((status) => {
          // Online orders commit stock when preparation starts, not when the
          // order is taken (spec.md "Stock deduction"). Said out loud, before
          // the tap, because it is the one irreversible-feeling step.
          const deductsStock = status === ONLINE_STOCK_DEDUCTION_STATUS && order.stockDeductedAt === null;

          return (
            <div key={status} className="flex flex-col gap-2">
              <Button
                type="button"
                className="h-14 w-full text-base sm:w-auto sm:self-start"
                disabled={mutation.isPending}
                onClick={() => move(status)}
              >
                {mutation.isPending ? (
                  <Spinner />
                ) : (
                  <ArrowRight className="size-5 rtl:-scale-x-100" aria-hidden="true" />
                )}
                {t(`advanceTo.${status}`)}
              </Button>
              {deductsStock && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                  <PackageMinus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {t("stockDeductionNotice")}
                </p>
              )}
            </div>
          );
        })}

        {canCancel &&
          (confirmingCancel ? (
            <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm text-foreground">
                {order.stockDeductedAt ? t("confirmCancelWithStock") : t("confirmCancel")}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  disabled={mutation.isPending}
                  onClick={() => move("CANCELLED")}
                >
                  {mutation.isPending && <Spinner />}
                  {t("confirmCancelAction")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmingCancel(false)}
                >
                  {t("keepOrder")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full text-destructive sm:w-auto sm:self-start"
              onClick={() => setConfirmingCancel(true)}
            >
              <XCircle className="size-5" aria-hidden="true" />
              {t("cancelOrder")}
            </Button>
          ))}
      </CardContent>
    </Card>
  );
}
