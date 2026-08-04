"use client";

import { useTranslations } from "next-intl";
import { MessageCircle, Percent } from "lucide-react";
import { CHECKOUT_BAR_HEIGHT_VAR } from "@/constants/layout";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { usePublishedHeight } from "@/hooks/use-published-height";
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
  onWhatsappOrder: () => void;
}

// Pinned to the bottom of the screen: the total and the buttons that finish
// the sale are always under the cashier's thumb, whatever the cart is
// scrolled to.
//
// The same cart ends one of two ways, and the choice is made here rather than
// up front: the counter sale is the primary button, and next to it is the
// order that gets delivered instead of handed over. Nobody has to decide
// which kind of sale this is before they start scanning.
export function CheckoutBar({
  totals,
  orderDiscount,
  canCheckout,
  isSubmitting,
  onOrderDiscountClick,
  onCheckout,
  onWhatsappOrder,
}: CheckoutBarProps) {
  const t = useTranslations("sell.checkout");
  const formatMoney = useMoneyFormatter();

  // The bar is out of the flow, and it grows and shrinks as discounts come
  // and go, so it tells the page how tall it currently is instead of the page
  // guessing — that guess is what leaves the last cart line stuck underneath.
  const ref = usePublishedHeight<HTMLDivElement>(CHECKOUT_BAR_HEIGHT_VAR);

  const hasItemDiscount = Number(totals.itemDiscountTotal) > 0;
  const hasOrderDiscount = Number(totals.orderDiscountAmount) > 0;

  return (
    // pb: iOS home indicator (CLAUDE.md "Mobile input & device specifics") —
    // without it the last few millimetres of the checkout button sit under
    // the indicator on a notched iPhone and can't be tapped.
    <div
      ref={ref}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[var(--safe-bottom)] backdrop-blur"
    >
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

        {/* Full width and the same height as the sale button: an order taken
            over WhatsApp is an everyday job here, not a secondary one, and it
            has to be reachable with the same thumb. */}
        <Button
          type="button"
          variant="outline"
          onClick={onWhatsappOrder}
          disabled={!canCheckout || isSubmitting}
          className="w-full"
        >
          <MessageCircle aria-hidden="true" />
          {t("whatsappOrder")}
        </Button>
      </div>
    </div>
  );
}
