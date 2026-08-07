"use client";

import { useTranslations } from "next-intl";
import { Gift, MessageCircle, Percent } from "lucide-react";
import { CHECKOUT_BAR_HEIGHT_VAR } from "@/constants/layout";
import { useDiscountLabel } from "@/hooks/use-discount-label";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { usePublishedHeight } from "@/hooks/use-published-height";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { CartTotals, DiscountState } from "@/types/cart";

interface CheckoutBarProps {
  totals: CartTotals;
  orderDiscount: DiscountState;
  canCheckout: boolean;
  isSubmitting: boolean;
  // Whether this account may give stock away — `can(user, "order.createGift")`
  // (Admin/Manager). False hides the action outright rather than disabling
  // it: an Employee has no business being shown a door they may not open,
  // and the backend refuses the request regardless (CLAUDE.md rule 5).
  canGift: boolean;
  onOrderDiscountClick: () => void;
  onCheckout: () => void;
  onWhatsappOrder: () => void;
  onGiftOrder: () => void;
}

// Pinned to the bottom of the screen: the total and the buttons that finish
// the sale are always under the cashier's thumb, whatever the cart is
// scrolled to.
//
// The same cart ends one of three ways, and the choice is made here rather
// than up front: the counter sale is the primary button, next to it is the
// order that gets delivered instead of handed over, and — for an Admin or a
// Manager — the cart that is given away rather than sold. Nobody has to
// decide which kind of order this is before they start scanning.
//
// Only the sale is solid brand teal. The other two are outlines, and the gift
// carries its own violet (see globals.css) so that the button which takes no
// money can never be reached for in place of the one that does.
export function CheckoutBar({
  totals,
  orderDiscount,
  canCheckout,
  isSubmitting,
  canGift,
  onOrderDiscountClick,
  onCheckout,
  onWhatsappOrder,
  onGiftOrder,
}: CheckoutBarProps) {
  const t = useTranslations("sell.checkout");
  const formatMoney = useMoneyFormatter();
  const discountLabel = useDiscountLabel();

  // The bar is out of the flow, and it grows and shrinks as discounts come
  // and go, so it tells the page how tall it currently is instead of the page
  // guessing — that guess is what leaves the last cart line stuck underneath.
  const ref = usePublishedHeight<HTMLDivElement>(CHECKOUT_BAR_HEIGHT_VAR);

  const hasItemDiscount = Number(totals.itemDiscountTotal) > 0;
  const hasOrderDiscount = Number(totals.orderDiscountAmount) > 0;
  // What was keyed in — "2%", or a flat sum — as opposed to what it took
  // off. The row below shows both, for the same reason a cart line does.
  const appliedOrderDiscount = discountLabel(orderDiscount.type, orderDiscount.value);

  return (
    // pb: iOS home indicator (CLAUDE.md "Mobile input & device specifics") —
    // without it the last few millimetres of the checkout button sit under
    // the indicator on a notched iPhone and can't be tapped.
    <div
      ref={ref}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[var(--safe-bottom)] backdrop-blur"
    >
      {/* Three stacked rows on a phone, where vertical room is the thing
          there is most of and the thumb wants full-width targets. One row
          from `lg`: a laptop's screen is wide and short, and a bar three
          rows deep would eat the bottom third of the cart beside it. Only
          the arrangement changes — every button keeps its full height, since
          a touch monitor is going on this counter too. */}
      <div
        className={cn(
          "mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-3",
          "lg:max-w-6xl lg:flex-row lg:items-center lg:gap-6"
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-1 text-sm",
            "lg:min-w-0 lg:flex-1 lg:flex-row lg:flex-wrap lg:items-baseline lg:gap-x-6 lg:gap-y-1"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground lg:justify-start lg:gap-2">
            <span>{t("subtotal", { count: totals.itemCount })}</span>
            <span className="tabular-nums">{formatMoney(totals.subtotal)}</span>
          </div>

          {hasItemDiscount && (
            <div className="flex items-center justify-between text-muted-foreground lg:justify-start lg:gap-2">
              <span>{t("itemDiscounts")}</span>
              <span className="tabular-nums">−{formatMoney(totals.itemDiscountTotal)}</span>
            </div>
          )}

          {hasOrderDiscount && (
            <div className="flex items-center justify-between text-muted-foreground lg:justify-start lg:gap-2">
              <span>
                {appliedOrderDiscount
                  ? t("orderDiscountApplied", { value: appliedOrderDiscount })
                  : t("orderDiscount")}
              </span>
              <span className="tabular-nums">−{formatMoney(totals.orderDiscountAmount)}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 text-2xl font-bold lg:justify-start lg:gap-3 lg:pt-0">
            <span>{t("total")}</span>
            <span className="tabular-nums">{formatMoney(totals.total)}</span>
          </div>
        </div>

        <div className="flex items-stretch gap-2 lg:shrink-0">
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
            has to be reachable with the same thumb. In the laptop's row both
            keep that height and take only the width of their own labels.

            The gift shares this row rather than sitting beside the sale
            button: a thumb reaching for "complete the sale" must not be able
            to land on it, and one row down is far enough away to make that
            impossible while still being a single tap for the Admin who
            actually wants it. */}
        <div className="flex items-stretch gap-2 lg:shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onWhatsappOrder}
            disabled={!canCheckout || isSubmitting}
            className="flex-1 lg:w-auto lg:flex-none lg:shrink-0"
          >
            <MessageCircle aria-hidden="true" />
            {t("whatsappOrder")}
          </Button>

          {/* Admin/Manager only. Hidden, not disabled — see canGift. */}
          {canGift && (
            <Button
              type="button"
              variant="outline"
              onClick={onGiftOrder}
              disabled={!canCheckout || isSubmitting}
              // The way IN to giving stock away, so it is an outline: the
              // solid violet is spent on the button inside the sheet that
              // actually commits it. It still carries the colour, because
              // this is where the cashier learns that violet means "no money".
              className="flex-1 border-gift/40 text-gift hover:bg-gift/10 hover:text-gift lg:w-auto lg:flex-none lg:shrink-0"
            >
              <Gift aria-hidden="true" />
              {t("giftOrder")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
