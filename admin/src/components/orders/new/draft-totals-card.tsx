"use client";

import { useTranslations } from "next-intl";
import { Tag } from "lucide-react";
import { Button, Typography } from "@store/ui";
import { GIFT_LINE_TOTAL } from "@/constants/orders";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { DiscountState, OrderDraftTotals } from "@/types/order";

interface DraftTotalsCardProps {
  totals: OrderDraftTotals;
  orderDiscount: DiscountState;
  isGift: boolean;
  onOrderDiscountClick: () => void;
}

// A client-side preview only; the server re-prices everything from the catalogue on save (see lib/money.ts).
export function DraftTotalsCard({ totals, orderDiscount, isGift, onOrderDiscountClick }: DraftTotalsCardProps) {
  const t = useTranslations("orders.new.totals");
  const tDiscount = useTranslations("orders.discount");
  const formatMoney = useMoneyFormatter();

  const hasOrderDiscount = !isGift && orderDiscount.type !== null && orderDiscount.value !== null;

  return (
    <div className="flex flex-col gap-2 text-label" data-test-selector="order-draft-totals">
      <div className="flex items-center justify-between gap-3">
        <Typography variant="small" tone="muted" as="span">
          {t("subtotal", { count: totals.itemCount })}
        </Typography>
        <Typography variant="small" as="span" className="tabular-nums">
          {formatMoney(totals.subtotal)}
        </Typography>
      </div>

      {!isGift && Number(totals.itemDiscountTotal) > 0 && (
        <div className="flex items-center justify-between gap-3">
          <Typography variant="small" tone="muted" as="span">
            {t("itemDiscounts")}
          </Typography>
          <Typography variant="small" tone="success" as="span" className="tabular-nums">
            −{formatMoney(totals.itemDiscountTotal)}
          </Typography>
        </div>
      )}

      {hasOrderDiscount && (
        <div className="flex items-center justify-between gap-3">
          <Typography variant="small" tone="muted" as="span">
            {t("orderDiscount", {
              label:
                orderDiscount.type === "PERCENT"
                  ? tDiscount("percentValue", { value: Number(orderDiscount.value) })
                  : formatMoney(orderDiscount.value ?? "0"),
            })}
          </Typography>
          <Typography variant="small" tone="success" as="span" className="tabular-nums">
            −{formatMoney(totals.orderDiscountAmount)}
          </Typography>
        </div>
      )}

      {isGift ? (
        <Typography variant="caption" tone="muted" as="p" data-test-selector="order-gift-note">
          {t("giftNote")}
        </Typography>
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={onOrderDiscountClick}
          icon={<Tag className="size-4" aria-hidden="true" />}
        >
          {hasOrderDiscount ? t("editOrderDiscount") : t("addOrderDiscount")}
        </Button>
      )}

      <div className="-mx-5 -mb-5 mt-2 flex items-center justify-between gap-3 rounded-b-card bg-primary-50 px-5 py-4">
        <Typography variant="small" weight="semibold" as="span">
          {t("total")}
        </Typography>
        <Typography variant="h1" weight="bold" as="span" className="tabular-nums">
          {formatMoney(isGift ? GIFT_LINE_TOTAL : totals.total)}
        </Typography>
      </div>
    </div>
  );
}
