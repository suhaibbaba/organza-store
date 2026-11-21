"use client";

import { useTranslations } from "next-intl";
import { ArrowRight, Check, ListChecks, PackageMinus } from "lucide-react";
import { Button, useToast, Typography } from "@store/ui";
import { ONLINE_STOCK_DEDUCTION_STATUS, ORDER_STATUS_TRANSITIONS } from "@store/shared/constants/order";
import type { Order, OrderStatus } from "@store/shared/types/order";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { ONLINE_ORDER_FLOW } from "@/constants/orders";
import { useUpdateOrderStatusMutation } from "@/hooks/use-orders";
import { cn } from "@/lib/utils";
import { DetailCard } from "@/components/layout/detail-card";
import { errorMessageKey } from "@/lib/error-message-key";

// Offers only the forward moves ORDER_STATUS_TRANSITIONS allows; cancelling lives in the header menu.
export function OrderStatusActions({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.statusActions");
  const tStatus = useTranslations("orders.status");
  const toast = useToast();
  const mutation = useUpdateOrderStatusMutation(order.id);

  const allowed = ORDER_STATUS_TRANSITIONS[order.status] ?? [];
  const forwardStatuses = allowed.filter((status) => status !== "CANCELLED" && status !== "RETURNED");
  // -1 for a STORE sale (opens COMPLETED) and for a cancelled/returned order.
  const currentStep = ONLINE_ORDER_FLOW.indexOf(order.status as (typeof ONLINE_ORDER_FLOW)[number]);
  const showFlow = currentStep !== -1;

  if (!showFlow && forwardStatuses.length === 0) {
    return null;
  }

  function move(status: OrderStatus) {
    mutation.mutate(status, {
      onSuccess: () => toast.success("orders.detail.statusActions.moved", { status: tStatus(status) }),
      onError: (error) => toast.error(errorMessageKey(error)),
    });
  }

  return (
    <DetailCard icon={ListChecks} title={t("title")} data-testid="order-status-card">
      {showFlow && (
        <ol className="flex items-start gap-1" aria-label={t("progressLabel")}>
          {ONLINE_ORDER_FLOW.map((status, index) => {
            const reached = index <= currentStep;
            const isCurrent = index === currentStep;
            // Done, current and upcoming are told apart by a tick and weight as well as colour, and spoken.
            return (
              <li
                key={status}
                aria-current={isCurrent ? "step" : undefined}
                className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
              >
                <div
                  aria-hidden="true"
                  className={cn("h-1.5 w-full rounded-pill", reached ? "bg-primary-600" : "bg-neutral-300")}
                />
                <Typography
                  variant="caption"
                  tone={isCurrent ? "brand" : "muted"}
                  weight={isCurrent ? "semibold" : undefined}
                  className="inline-flex items-center gap-1 text-center"
                >
                  {reached && !isCurrent && <Check className="size-3 shrink-0" aria-hidden="true" />}
                  {tStatus(status)}
                  {reached && (
                    <Typography as="span" variant="caption" tone="inherit" className="sr-only">
                      {isCurrent ? t("stepCurrent") : t("stepDone")}
                    </Typography>
                  )}
                </Typography>
              </li>
            );
          })}
        </ol>
      )}

      {forwardStatuses.map((status) => {
        // Online orders commit stock when preparation starts (spec.md "Stock deduction"); said before the tap.
        const deductsStock = status === ONLINE_STOCK_DEDUCTION_STATUS && order.stockDeductedAt === null;
        return (
          <div key={status} className="flex flex-col gap-2">
            <Button
              className="w-full"
              isLoading={mutation.isPending}
              onClick={() => move(status)}
              data-test-selector={testSelectorFor("order-status-advance", status)}
              icon={<ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />}
            >
              {t(`advanceTo.${status}`)}
            </Button>
            {deductsStock && (
              <Typography
                variant="small"
                className="flex items-start gap-2 rounded-panel bg-warning-50 p-3 text-warning-700"
              >
                <PackageMinus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t("stockDeductionNotice")}
              </Typography>
            )}
          </div>
        );
      })}
    </DetailCard>
  );
}
