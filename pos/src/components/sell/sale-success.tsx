"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Gift } from "lucide-react";
import { GIFT_ORDER_TYPE } from "@shared/constants/order";
import type { Order } from "@shared/types/order";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Button } from "@/components/ui/button";
import { POS_ORDER_CHANNEL, SALE_SUCCESS_RESET_MS } from "@/constants/pos";
import { cn } from "@/lib/utils";

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
//
// A gift is finished, but nothing was taken for it. Showing it the same way
// as a sale would put a big "0.00" where the amount goes, which reads as a
// sale that went wrong rather than as a piece deliberately given away — so it
// gets the violet of the button that made it, and says the two things that
// are actually true: the stock has left, and no money was taken.
export function SaleSuccess({ order, onNewSale }: SaleSuccessProps) {
  const t = useTranslations("sell.success");
  const formatMoney = useMoneyFormatter();

  const isGift = order.type === GIFT_ORDER_TYPE;
  const isCounterSale = order.channel === POS_ORDER_CHANNEL;
  const giftedCount = order.items.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    const timer = setTimeout(onNewSale, SALE_SUCCESS_RESET_MS);
    return () => clearTimeout(timer);
  }, [onNewSale]);

  return (
    <div
      // A completed sale is worth announcing to a screen reader without
      // stealing focus from whatever the cashier does next.
      role="status"
      className={cn(
        "flex flex-col items-center gap-4 rounded-xl border px-6 py-12 text-center",
        isGift ? "border-gift/30 bg-gift/10" : "border-emerald-500/30 bg-emerald-500/10"
      )}
    >
      {isGift ? (
        <Gift className="size-12 text-gift" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="size-12 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      )}

      <div className="flex flex-col gap-1">
        <p className="text-xl font-semibold">
          {isGift ? t("giftTitle") : isCounterSale ? t("title") : t("whatsappTitle")}
        </p>
        {/* A counter sale hands over a receipt; a WhatsApp order is quoted
            back to the customer in the chat as an order number. A gift keeps
            a number too — it is the record of what left the shop. */}
        <p className="text-sm text-muted-foreground">
          {isCounterSale
            ? t("orderNumber", { number: order.orderNumber })
            : t("whatsappOrderNumber", { number: order.orderNumber })}
        </p>
        {!isGift && !isCounterSale && order.customerName && (
          <p className="text-sm text-muted-foreground">{t("customer", { name: order.customerName })}</p>
        )}
      </div>

      {isGift ? (
        // What a gift's headline figure is: pieces gone, not money in.
        <p className="text-3xl font-bold tabular-nums text-gift">{t("giftCount", { count: giftedCount })}</p>
      ) : (
        <p className="text-3xl font-bold tabular-nums">{formatMoney(order.total)}</p>
      )}

      {isGift && <p className="max-w-xs text-sm text-muted-foreground">{t("giftNextStep")}</p>}
      {!isGift && !isCounterSale && <p className="max-w-xs text-sm text-muted-foreground">{t("whatsappNextStep")}</p>}

      <Button type="button" onClick={onNewSale} className="w-full max-w-xs">
        {t("newSale")}
      </Button>
    </div>
  );
}
