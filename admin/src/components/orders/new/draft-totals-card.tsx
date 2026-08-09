"use client";

import { useTranslations } from "next-intl";
import { Percent } from "lucide-react";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DiscountState, OrderDraftTotals } from "@/types/order";

interface DraftTotalsCardProps {
  totals: OrderDraftTotals;
  orderDiscount: DiscountState;
  onOrderDiscountClick: () => void;
}

// The running total, worked out client-side purely so it can be read back to
// the customer before the order is saved. The server re-prices everything
// from the catalogue when it lands (see lib/money.ts).
export function DraftTotalsCard({ totals, orderDiscount, onOrderDiscountClick }: DraftTotalsCardProps) {
  const t = useTranslations("orders.new.totals");
  const tDiscount = useTranslations("orders.discount");
  const formatMoney = useMoneyFormatter();

  const hasOrderDiscount = orderDiscount.type !== null && orderDiscount.value !== null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{t("subtotal", { count: totals.itemCount })}</span>
          <span className="tabular-nums text-foreground">{formatMoney(totals.subtotal)}</span>
        </div>

        {Number(totals.itemDiscountTotal) > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{t("itemDiscounts")}</span>
            <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
              −{formatMoney(totals.itemDiscountTotal)}
            </span>
          </div>
        )}

        {hasOrderDiscount && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">
              {t("orderDiscount", {
                label:
                  orderDiscount.type === "PERCENT"
                    ? tDiscount("percentValue", { value: Number(orderDiscount.value) })
                    : formatMoney(orderDiscount.value ?? "0"),
              })}
            </span>
            <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
              −{formatMoney(totals.orderDiscountAmount)}
            </span>
          </div>
        )}

        <Button type="button" variant="outline" className="w-full sm:w-auto sm:self-start" onClick={onOrderDiscountClick}>
          <Percent className="size-4" aria-hidden="true" />
          {hasOrderDiscount ? t("editOrderDiscount") : t("addOrderDiscount")}
        </Button>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
          <span className="font-semibold text-foreground">{t("total")}</span>
          <span className="text-xl font-bold tabular-nums text-foreground">{formatMoney(totals.total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
