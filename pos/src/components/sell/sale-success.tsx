"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Gift, Repeat } from "lucide-react";
import { GIFT_ORDER_TYPE } from "@store/shared/constants/order";
import type { Order } from "@store/shared/types/order";
import { SELECTABLE } from "@store/shared/lib/nativeGestures";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Button, Typography } from "@store/ui";
import { POS_ORDER_CHANNEL, SALE_SUCCESS_RESET_MS } from "@/constants/pos";
import { fromCents, toCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ExchangeOutcome } from "@/types/exchange";

interface SaleSuccessProps {
  order: Order;
  onNewSale: () => void;
  // Set after an exchange: the headline is the money that changed hands, not the new pieces' total.
  exchange?: ExchangeOutcome | null;
}

// Clears itself after a few seconds; a WhatsApp order is filed not finished, and a gift shows pieces gone, never a 0.00 that reads as a failed sale.
export function SaleSuccess({ order, onNewSale, exchange = null }: SaleSuccessProps) {
  const t = useTranslations("sell.success");
  const formatMoney = useMoneyFormatter();

  const isGift = order.type === GIFT_ORDER_TYPE;
  const isCounterSale = order.channel === POS_ORDER_CHANNEL;
  const giftedCount = order.items.reduce((total, item) => total + item.quantity, 0);

  const exchangeAmount = exchange ? formatMoney(fromCents(Math.abs(toCents(exchange.difference)))) : "";

  useEffect(() => {
    const timer = setTimeout(onNewSale, SALE_SUCCESS_RESET_MS);
    return () => clearTimeout(timer);
  }, [onNewSale]);

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center gap-4 rounded-panel border px-6 py-12 text-center",
        isGift ? "border-tint-3-ink/30 bg-tint-3-bg" : "border-success-300 bg-success-50",
      )}
    >
      {exchange ? (
        <Repeat className="size-12 text-success-700" aria-hidden="true" />
      ) : isGift ? (
        <Gift className="size-12 text-tint-3-ink" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="size-12 text-success-700" aria-hidden="true" />
      )}

      <div className="flex flex-col gap-1">
        <Typography variant="h2" weight="semibold">
          {exchange ? t("exchangeTitle") : isGift ? t("giftTitle") : isCounterSale ? t("title") : t("whatsappTitle")}
        </Typography>
        <Typography variant="small" tone="muted" {...SELECTABLE}>
          {exchange && order.exchangeOf
            ? t("exchangeOrderNumbers", { original: order.exchangeOf.orderNumber, number: order.orderNumber })
            : isCounterSale
              ? t("orderNumber", { number: order.orderNumber })
              : t("whatsappOrderNumber", { number: order.orderNumber })}
        </Typography>
        {/* A credit sale names who owes it, and how much is still to come. */}
        {order.customerName && (order.onCredit || (!isGift && !isCounterSale)) && (
          <Typography variant="small" tone="muted">
            {t("customer", { name: order.customerName })}
          </Typography>
        )}
      </div>

      {exchange ? (
        <div className="flex flex-col items-center gap-1" data-test-selector="pos-exchange-success">
          <Typography variant="display" className="tabular-nums">
            {exchangeAmount}
          </Typography>
          <Typography variant="h3" weight="semibold" tone={exchange.settlement === "REFUNDED" ? "error" : "ink"}>
            {t(`exchangeSettled.${exchange.settlement}`, { amount: exchangeAmount })}
          </Typography>
        </div>
      ) : isGift ? (
        // What a gift's headline figure is: pieces gone, not money in.
        <Typography variant="display" tone="inherit" className="tabular-nums text-tint-3-ink">
          {t("giftCount", { count: giftedCount })}
        </Typography>
      ) : (
        <Typography variant="display" className="tabular-nums">
          {formatMoney(order.total)}
        </Typography>
      )}

      {order.onCredit && Number(order.balance) > 0 && (
        <Typography
          variant="h3"
          weight="semibold"
          tone="error"
          className="tabular-nums"
          data-test-selector="pos-sale-credit-balance"
        >
          {t("creditBalance", { amount: formatMoney(order.balance) })}
        </Typography>
      )}
      {(isGift || !isCounterSale) && (
        <Typography variant="small" tone="muted" className="max-w-xs">
          {isGift ? t("giftNextStep") : t("whatsappNextStep")}
        </Typography>
      )}

      <Button type="button" onClick={onNewSale} data-testid="pos-new-sale" className={"w-full max-w-xs"}>
        {t("newSale")}
      </Button>
    </div>
  );
}
