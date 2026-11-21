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
        <span className="text-ink-muted">{t("subtotal", { count: totals.itemCount })}</span>
        <span className="tabular-nums text-ink">{formatMoney(totals.subtotal)}</span>
      </div>

      {!isGift && Number(totals.itemDiscountTotal) > 0 && (
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
        <span className="font-semibold text-ink">{t("total")}</span>
        <Typography variant="h1" weight="bold" as="span" className="tabular-nums">{formatMoney(isGift ? GIFT_LINE_TOTAL : totals.total)}</Typography>
      </div>
    </div>
  );
}
