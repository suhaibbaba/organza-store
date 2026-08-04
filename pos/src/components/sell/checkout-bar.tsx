"use client";

import { useTranslations } from "next-intl";
import { Percent } from "lucide-react";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { CartTotals, DiscountState } from "@/types/cart";

interface CheckoutBarProps {
  totals: CartTotals;
  orderDiscount: DiscountState;
  canCheckout: boolean;
  isSubmitting: boolean;
  onOrderDiscountClick: () => void;
  onCheckout: () => void;
}

// Pinned to the bottom of the screen: the total and the one button that
// finishes the sale are always under the cashier's thumb, whatever the cart
// is scrolled to.
export function CheckoutBar({
  totals,
  orderDiscount,
  canCheckout,
  isSubmitting,
  onOrderDiscountClick,
  onCheckout,
}: CheckoutBarProps) {
  const t = useTranslations("sell.checkout");
  const formatMoney = useMoneyFormatter();

  const hasItemDiscount = Number(totals.itemDiscountTotal) > 0;
  const hasOrderDiscount = Number(totals.orderDiscountAmount) > 0;

  return (
    // pb: iOS home indicator (CLAUDE.md "Mobile input & device specifics") —
    // without it the last few millimetres of the checkout button sit under
    // the indicator on a notched iPhone and can't be tapped.
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-3">
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>{t("subtotal", { count: totals.itemCount })}</span>
            <span className="tabular-nums">{formatMoney(totals.subtotal)}</span>
          </div>

          {hasItemDiscount && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{t("itemDiscounts")}</span>
              <span className="tabular-nums">−{formatMoney(totals.itemDiscountTotal)}</span>
            </div>
          )}

          {hasOrderDiscount && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{t("orderDiscount")}</span>
              <span className="tabular-nums">−{formatMoney(totals.orderDiscountAmount)}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 text-2xl font-bold">
            <span>{t("total")}</span>
            <span className="tabular-nums">{formatMoney(totals.total)}</span>
          </div>
        </div>

        <div className="flex items-stretch gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onOrderDiscountClick}
            disabled={!canCheckout}
            className="shrink-0"
          >
            <Percent aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">
              {orderDiscount.type ? t("editOrderDiscount") : t("addOrderDiscount")}
            </span>
          </Button>

          <Button type="button" onClick={onCheckout} disabled={!canCheckout || isSubmitting} className="flex-1 text-lg">
            {isSubmitting ? (
              <>
                <Spinner />
                {t("submitting")}
              </>
            ) : (
              t("submit")
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
