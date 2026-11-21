"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, PackageMinus, XCircle } from "lucide-react";
import { Alert, Button, Card } from "@store/ui";
import { can } from "@organza/shared/lib/permissions";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { ONLINE_STOCK_DEDUCTION_STATUS, ORDER_STATUS_TRANSITIONS } from "@organza/shared/constants/order";
import type { Order, OrderStatus } from "@organza/shared/types/order";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { ONLINE_ORDER_FLOW } from "@/constants/orders";
import { useSession } from "@/components/providers/session-provider";
import { useUpdateOrderStatusMutation } from "@/hooks/use-orders";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

// Offers only the moves ORDER_STATUS_TRANSITIONS allows (the backend's table); RETURNED only ever comes from the returns action.
export function OrderStatusActions({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.statusActions");
  const tStatus = useTranslations("orders.status");
  const { user } = useSession();
  const translateError = useTranslateError();
  const mutation = useUpdateOrderStatusMutation(order.id);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const allowed = ORDER_STATUS_TRANSITIONS[order.status] ?? [];
  const forwardStatuses = allowed.filter((status) => status !== "CANCELLED" && status !== "RETURNED");
  const canCancel = allowed.includes("CANCELLED") && can(user, "order.cancel");

  // -1 for a STORE sale (opens COMPLETED) and for a cancelled/returned order.
  const currentStep = ONLINE_ORDER_FLOW.indexOf(order.status as (typeof ONLINE_ORDER_FLOW)[number]);
  const showFlow = currentStep !== -1;

  function move(status: OrderStatus) {
    setConfirmingCancel(false);
    mutation.mutate(status);
  }

  if (!showFlow && forwardStatuses.length === 0 && !canCancel) return null;

  return (
    <Card className="flex flex-col gap-4">
      {showFlow && (
        <ol className="flex items-center gap-1" aria-label={t("progressLabel")}>
          {ONLINE_ORDER_FLOW.map((status, index) => {
            const isDone = index < currentStep;
            const isCurrent = index === currentStep;
            return (
              <li key={status} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-2 w-full rounded-pill",
                    isDone || isCurrent ? "bg-primary-600" : "bg-inset"
                  )}
                />
                <span
                  className={cn(
                    "truncate text-center text-micro",
                    isCurrent ? "font-semibold text-primary-600" : "text-ink-muted"
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
        <Alert tone="danger" data-testid="alert-destructive">
          {translateError(mutation.error instanceof ApiError ? mutation.error.code : ERROR_CODES.INTERNAL)}
        </Alert>
      )}

      {mutation.isSuccess && !mutation.isPending && (
        <Alert tone="success" data-testid="alert-success">
          {t("moved", { status: tStatus(order.status) })}
        </Alert>
      )}

      {forwardStatuses.map((status) => {
        // Online orders commit stock when preparation starts (spec.md "Stock deduction"); said before the tap.
        const deductsStock = status === ONLINE_STOCK_DEDUCTION_STATUS && order.stockDeductedAt === null;

        return (
          <div key={status} className="flex flex-col gap-2">
            <Button
              type="button"
              className="w-full sm:w-auto sm:self-start"
              isLoading={mutation.isPending}
              onClick={() => move(status)}
              data-test-selector={testSelectorFor("order-status-advance", status)}
              icon={<ArrowRight className="size-5 rtl:-scale-x-100" aria-hidden="true" />}
            >
              {t(`advanceTo.${status}`)}
            </Button>
            {deductsStock && (
              <p className="flex items-start gap-2 rounded-panel bg-warning-50 p-3 text-micro text-warning-700">
                <PackageMinus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t("stockDeductionNotice")}
              </p>
            )}
          </div>
        );
      })}

      {canCancel &&
        (confirmingCancel ? (
          <div className="flex flex-col gap-2 rounded-panel border border-danger-200 bg-danger-50 p-3">
            <p className="text-label text-ink">
              {order.stockDeductedAt ? t("confirmCancelWithStock") : t("confirmCancel")}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="danger"
                className="flex-1"
                isLoading={mutation.isPending}
                onClick={() => move("CANCELLED")}
                data-test-selector="order-cancel-confirm"
              >
                {t("confirmCancelAction")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmingCancel(false)}
                data-test-selector="order-cancel-abort"
              >
                {t("keepOrder")}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="w-full text-danger-600 hover:text-danger-700 sm:w-auto sm:self-start"
            onClick={() => setConfirmingCancel(true)}
            data-test-selector="order-cancel"
            icon={<XCircle className="size-5" aria-hidden="true" />}
          >
            {t("cancelOrder")}
          </Button>
        ))}
    </Card>
  );
}
