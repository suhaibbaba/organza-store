"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import type { Order } from "@shared/types/order";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Button } from "@/components/ui/button";
import { SALE_SUCCESS_RESET_MS } from "@/constants/pos";

interface SaleSuccessProps {
  order: Order;
  onNewSale: () => void;
}

// Confirmation the sale went through: the order number to read out, and the
// amount taken. It clears itself after a few seconds so the till is never
// left sitting on a finished sale when the next customer walks up — and
// "new sale" is right there for whoever is quicker than the timer.
export function SaleSuccess({ order, onNewSale }: SaleSuccessProps) {
  const t = useTranslations("sell.success");
  const formatMoney = useMoneyFormatter();

  useEffect(() => {
    const timer = setTimeout(onNewSale, SALE_SUCCESS_RESET_MS);
    return () => clearTimeout(timer);
  }, [onNewSale]);

  return (
    <div
      // A completed sale is worth announcing to a screen reader without
      // stealing focus from whatever the cashier does next.
      role="status"
      className="flex flex-col items-center gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-12 text-center"
    >
      <CheckCircle2 className="size-12 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />

      <div className="flex flex-col gap-1">
        <p className="text-xl font-semibold">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("orderNumber", { number: order.orderNumber })}</p>
      </div>

      <p className="text-3xl font-bold tabular-nums">{formatMoney(order.total)}</p>

      <Button type="button" onClick={onNewSale} className="w-full max-w-xs">
        {t("newSale")}
      </Button>
    </div>
  );
}
