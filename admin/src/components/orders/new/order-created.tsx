"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, Plus } from "lucide-react";
import { Button, buttonClassName } from "@store/ui";
import type { Order } from "@organza/shared/types/order";
import { Link } from "@/i18n/navigation";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";

interface OrderCreatedProps {
  order: Order;
  onNewOrder: () => void;
}

// Unlike the POS this does not clear itself: opening the order or starting another is the user's decision.
export function OrderCreated({ order, onNewOrder }: OrderCreatedProps) {
  const t = useTranslations("orders.new.success");
  const formatMoney = useMoneyFormatter();

  return (
    <div
      role="status"
      className="flex flex-col items-center gap-4 rounded-card border border-success-300 bg-success-50 px-6 py-12 text-center"
    >
      <CheckCircle2 className="size-12 text-success-700" aria-hidden="true" />

      <div className="flex flex-col gap-1">
        <p className="text-title font-semibold text-ink">{t("title")}</p>
        <p className="text-label text-ink-muted">{t("orderNumber", { number: String(order.orderNumber) })}</p>
      </div>

      <p className="text-kpi font-bold tabular-nums text-ink">{formatMoney(order.total)}</p>

      {/* The order opens NEW with no stock taken yet; stock moves when preparation starts (spec.md "Stock deduction"). */}
      <p className="text-label text-ink-muted">{t("nextStep")}</p>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <Link href={`/orders/${order.id}`} className={buttonClassName({ className: "w-full sm:w-auto sm:self-center" })}>
          {t("openOrder")}
        </Link>
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto sm:self-center"
          onClick={onNewOrder}
          icon={<Plus className="size-5" aria-hidden="true" />}
        >
          {t("newOrder")}
        </Button>
      </div>
    </div>
  );
}
