"use client";

import { useTranslations } from "next-intl";
import { Tag } from "lucide-react";
import { Button, Card } from "@store/ui";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { DiscountState, OrderDraftTotals } from "@/types/order";

interface DraftTotalsCardProps {
  totals: OrderDraftTotals;
  orderDiscount: DiscountState;
  onOrderDiscountClick: () => void;
}

// A client-side preview only; the server re-prices everything from the catalogue on save (see lib/money.ts).
export function DraftTotalsCard({ totals, orderDiscount, onOrderDiscountClick }: DraftTotalsCardProps) {
  const t = useTranslations("orders.new.totals");
  const tDiscount = useTranslations("orders.discount");
  const formatMoney = useMoneyFormatter();

  const hasOrderDiscount = orderDiscount.type !== null && orderDiscount.value !== null;

  return (
    <Card className="flex flex-col gap-2 text-label">
      <div className="flex items-center justify-between gap-3">
        <span className="text-ink-muted">{t("subtotal", { count: totals.itemCount })}</span>
        <span className="tabular-nums text-ink">{formatMoney(totals.subtotal)}</span>
      </div>

      {Number(totals.itemDiscountTotal) > 0 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-muted">{t("itemDiscounts")}</span>
          <span className="tabular-nums text-success-700">
            −{formatMoney(totals.itemDiscountTotal)}
          </span>
        </div>
      )}

      {hasOrderDiscount && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-muted">
            {t("orderDiscount", {
              label:
                orderDiscount.type === "PERCENT"
                  ? tDiscount("percentValue", { value: Number(orderDiscount.value) })
                  : formatMoney(orderDiscount.value ?? "0"),
            })}
          </span>
          <span className="tabular-nums text-success-700">
            −{formatMoney(totals.orderDiscountAmount)}
          </span>
        </div>
      )}

      <Button
        type="button"
        variant="secondary"
        className="w-full sm:w-auto sm:self-start"
        onClick={onOrderDiscountClick}
        icon={<Tag className="size-4" aria-hidden="true" />}
      >
        {hasOrderDiscount ? t("editOrderDiscount") : t("addOrderDiscount")}
      </Button>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-2">
        <span className="font-semibold text-ink">{t("total")}</span>
        <span className="text-title font-bold tabular-nums text-ink">{formatMoney(totals.total)}</span>
      </div>
    </Card>
  );
}
