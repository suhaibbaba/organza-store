"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Gift } from "lucide-react";
import { GIFT_ORDER_TYPE } from "@store/shared/constants/order";
import type { Order } from "@store/shared/types/order";
import { SELECTABLE } from "@store/shared/lib/nativeGestures";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Button } from "@store/ui";
import { POS_ORDER_CHANNEL, SALE_SUCCESS_RESET_MS } from "@/constants/pos";
import { cn } from "@/lib/utils";
import { SHEET_ACTION } from "@/components/sell/sheet-styles";

interface SaleSuccessProps {
  order: Order;
  onNewSale: () => void;
}

// Clears itself after a few seconds; a WhatsApp order is filed not finished, and a gift shows pieces gone, never a 0.00 that reads as a failed sale.
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
      role="status"
      className={cn(
        "flex flex-col items-center gap-4 rounded-panel border px-6 py-12 text-center",
        isGift ? "border-tint-3-ink/30 bg-tint-3-bg" : "border-success-300 bg-success-50"
      )}
    >
      {isGift ? (
        <Gift className="size-12 text-tint-3-ink" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="size-12 text-success-700" aria-hidden="true" />
      )}

      <div className="flex flex-col gap-1">
        <p className="text-xl font-semibold text-ink">
          {isGift ? t("giftTitle") : isCounterSale ? t("title") : t("whatsappTitle")}
        </p>
        <p className="text-sm text-ink-muted" {...SELECTABLE}>
          {isCounterSale
            ? t("orderNumber", { number: order.orderNumber })
            : t("whatsappOrderNumber", { number: order.orderNumber })}
        </p>
        {!isGift && !isCounterSale && order.customerName && (
          <p className="text-sm text-ink-muted">{t("customer", { name: order.customerName })}</p>
        )}
      </div>

      {isGift ? (
        // What a gift's headline figure is: pieces gone, not money in.
        <p className="text-3xl font-bold tabular-nums text-tint-3-ink">{t("giftCount", { count: giftedCount })}</p>
      ) : (
        <p className="text-3xl font-bold tabular-nums text-ink">{formatMoney(order.total)}</p>
      )}

      {isGift && <p className="max-w-xs text-sm text-ink-muted">{t("giftNextStep")}</p>}
      {!isGift && !isCounterSale && <p className="max-w-xs text-sm text-ink-muted">{t("whatsappNextStep")}</p>}

      <Button type="button" onClick={onNewSale} data-testid="pos-new-sale" className={`${SHEET_ACTION} w-full max-w-xs`}>
        {t("newSale")}
      </Button>
    </div>
  );
}
