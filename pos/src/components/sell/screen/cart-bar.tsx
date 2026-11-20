"use client";

import { useTranslations } from "next-intl";
import { ShoppingBag } from "lucide-react";
import { CHECKOUT_BAR_HEIGHT_VAR } from "@/constants/layout";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { usePublishedHeight } from "@/hooks/use-published-height";
import { cn } from "@/lib/utils";
import { CONTROL_HEIGHT, CONTROL_SIZE } from "@/components/sell/screen/control-styles";
import type { CartTotals } from "@/types/cart";

interface CartBarProps {
  totals: CartTotals;
  onOpen: () => void;
  className?: string;
}

// Below 1000px the cart is not on screen, so this bar stands for it: how many
// pieces, the total, and the one button that opens the cart to finish the
// sale. Cart on the start side, the button at the end, sized to its words.
export function CartBar({ totals, onOpen, className }: CartBarProps) {
  const t = useTranslations("sell");
  const formatMoney = useMoneyFormatter();
  // Fixed, so it tells the page how much room to leave under the grid.
  const ref = usePublishedHeight<HTMLDivElement>(CHECKOUT_BAR_HEIGHT_VAR);

  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[var(--safe-bottom)] shadow-[0_-4px_16px_-8px_rgb(0_0_0/0.12)]",
        className
      )}
      data-test-selector="pos-cart-bar"
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 tab:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(CONTROL_SIZE, "relative flex shrink-0 items-center justify-center rounded-control bg-pale text-pale-foreground")}
            role="img"
            aria-label={t("screen.cartCount", { count: totals.itemCount })}
          >
            <ShoppingBag className="size-5" aria-hidden="true" />
            {totals.itemCount > 0 && (
              <span
                className="absolute -end-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full bg-blush px-1 text-xs font-bold leading-none text-blush-foreground tabular-nums min-h-5"
                aria-hidden="true"
              >
                {totals.itemCount}
              </span>
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-xs text-muted-foreground">{t("checkout.total")}</span>
            <span className="truncate text-lg font-bold tabular-nums" data-test-selector="pos-cart-bar-total">
              {formatMoney(totals.total)}
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={onOpen}
          data-test-selector="pos-cart-open"
          className={cn(
            CONTROL_HEIGHT,
            "inline-flex shrink-0 items-center justify-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground",
            "transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          {t("screen.viewCart")}
        </button>
      </div>
    </div>
  );
}
