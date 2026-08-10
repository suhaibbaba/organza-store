"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, Plus } from "lucide-react";
import type { Order } from "@organza/shared/types/order";
import { Link } from "@/i18n/navigation";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Button } from "@/components/ui/button";

interface OrderCreatedProps {
  order: Order;
  onNewOrder: () => void;
}

// Confirmation the order was written down: the number to quote back in the
// chat, and the amount. Unlike the POS this does not clear itself — a
// WhatsApp order is typed sitting down, and the next step (open it, or start
// another) is a decision, not a queue of customers.
export function OrderCreated({ order, onNewOrder }: OrderCreatedProps) {
  const t = useTranslations("orders.new.success");
  const formatMoney = useMoneyFormatter();

  return (
    <div
      // Worth announcing to a screen reader without stealing focus.
      role="status"
      className="flex flex-col items-center gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-12 text-center"
    >
      <CheckCircle2 className="size-12 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />

      <div className="flex flex-col gap-1">
        <p className="text-xl font-semibold">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("orderNumber", { number: String(order.orderNumber) })}</p>
      </div>

      <p className="text-3xl font-bold tabular-nums">{formatMoney(order.total)}</p>

      {/* The order opens NEW with nothing taken off the shelf yet — stock
          moves when preparation starts (spec.md "Stock deduction"). */}
      <p className="text-sm text-muted-foreground">{t("nextStep")}</p>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button asChild className="w-full sm:w-auto sm:self-center">
          <Link href={`/orders/${order.id}`}>{t("openOrder")}</Link>
        </Button>
        <Button type="button" variant="outline" className="w-full sm:w-auto sm:self-center" onClick={onNewOrder}>
          <Plus className="size-5" aria-hidden="true" />
          {t("newOrder")}
        </Button>
      </div>
    </div>
  );
}
