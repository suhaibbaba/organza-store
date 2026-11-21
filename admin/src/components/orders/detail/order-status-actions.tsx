"use client";

import { useTranslations } from "next-intl";
import { ArrowRight, ListChecks, PackageMinus } from "lucide-react";
import { Button, useToast } from "@store/ui";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { ONLINE_STOCK_DEDUCTION_STATUS, ORDER_STATUS_TRANSITIONS } from "@organza/shared/constants/order";
import type { Order, OrderStatus } from "@organza/shared/types/order";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { ONLINE_ORDER_FLOW } from "@/constants/orders";
import { useUpdateOrderStatusMutation } from "@/hooks/use-orders";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { DetailCard } from "@/components/layout/detail-card";

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

  if (!showFlow && forwardStatuses.length === 0) return null;

  function move(status: OrderStatus) {
    mutation.mutate(status, {
      onSuccess: () => toast.success("orders.detail.statusActions.moved", { status: tStatus(status) }),
      onError: (error) => toast.error(error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL),
    });
  }

  return (
    <DetailCard icon={ListChecks} title={t("title")} data-testid="order-status-card">
      {showFlow && (
        <ol className="flex items-start gap-1" aria-label={t("progressLabel")}>
          {ONLINE_ORDER_FLOW.map((status, index) => {
            const reached = index <= currentStep;
            return (
              <li key={status} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className={cn("h-1.5 w-full rounded-pill", reached ? "bg-primary-600" : "bg-inset")} />
                <span
                  className={cn(
                    "text-center text-micro",
                    index === currentStep ? "font-medium text-primary-700" : "text-ink-muted"
                  )}
                >
                  {tStatus(status)}
                </span>
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
              <p className="flex items-start gap-2 rounded-panel bg-warning-50 p-3 text-label text-warning-700">
                <PackageMinus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t("stockDeductionNotice")}
              </p>
            )}
          </div>
        );
      })}
    </DetailCard>
  );
}
