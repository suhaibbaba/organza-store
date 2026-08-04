"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import type { Order } from "@shared/types/order";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Button } from "@/components/ui/button";
import { POS_ORDER_CHANNEL, SALE_SUCCESS_RESET_MS } from "@/constants/pos";

interface SaleSuccessProps {
  order: Order;
  onNewSale: () => void;
}

// Confirmation the sale went through: the order number to read out, and the
// amount taken. It clears itself after a few seconds so the till is never
// left sitting on a finished sale when the next customer walks up — and
// "new sale" is right there for whoever is quicker than the timer.
//
// A WhatsApp order is not finished, it is filed: it says so, names the
// customer it goes to, and says what happens next, because the goods are
// still on the shelf until someone starts preparing it.
export function SaleSuccess({ order, onNewSale }: SaleSuccessProps) {
  const t = useTranslations("sell.success");
  const formatMoney = useMoneyFormatter();

  const isCounterSale = order.channel === POS_ORDER_CHANNEL;

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
        <p className="text-xl font-semibold">{isCounterSale ? t("title") : t("whatsappTitle")}</p>
        {/* A counter sale hands over a receipt; a WhatsApp order is quoted
            back to the customer in the chat as an order number. */}
        <p className="text-sm text-muted-foreground">
          {isCounterSale
            ? t("orderNumber", { number: order.orderNumber })
            : t("whatsappOrderNumber", { number: order.orderNumber })}
        </p>
        {!isCounterSale && order.customerName && (
          <p className="text-sm text-muted-foreground">{t("customer", { name: order.customerName })}</p>
        )}
      </div>

      <p className="text-3xl font-bold tabular-nums">{formatMoney(order.total)}</p>

      {!isCounterSale && <p className="max-w-xs text-sm text-muted-foreground">{t("whatsappNextStep")}</p>}

      <Button type="button" onClick={onNewSale} className="w-full max-w-xs">
        {t("newSale")}
      </Button>
    </div>
  );
}
