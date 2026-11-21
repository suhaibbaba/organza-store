"use client";

import { useTranslations } from "next-intl";
import { ShoppingBag } from "lucide-react";
import { CHECKOUT_BAR_HEIGHT_VAR } from "@/constants/layout";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { usePublishedHeight } from "@/hooks/use-published-height";
import { Button } from "@store/ui";
import { cn } from "@/lib/utils";
import { CONTROL_HEIGHT, CONTROL_SIZE } from "@/components/sell/screen/control-styles";
import type { CartTotals } from "@/types/cart";

interface CartBarProps {
  totals: CartTotals;
  onOpen: () => void;
  className?: string;
}

// Below 1000px this bar stands for the cart: how many pieces, the total, and the button that opens it.
export function CartBar({ totals, onOpen, className }: CartBarProps) {
  const t = useTranslations("sell");
  const formatMoney = useMoneyFormatter();
  // Fixed, so it tells the page how much room to leave under the grid.
  const ref = usePublishedHeight<HTMLDivElement>(CHECKOUT_BAR_HEIGHT_VAR);

  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[var(--safe-bottom)] shadow-float",
        className
      )}
      data-test-selector="pos-cart-bar"
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 tab:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(CONTROL_SIZE, "relative flex shrink-0 items-center justify-center rounded-control bg-primary-50 text-primary-700")}
            role="img"
            aria-label={t("screen.cartCount", { count: totals.itemCount })}
          >
            <ShoppingBag className="size-5" aria-hidden="true" />
            {totals.itemCount > 0 && (
              <span
                className="absolute -end-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-pill bg-warning-300 px-1 text-micro font-bold leading-none text-warning-800 tabular-nums min-h-5"
                aria-hidden="true"
              >
                {totals.itemCount}
              </span>
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-micro text-ink-muted">{t("checkout.total")}</span>
            <span className="truncate text-heading font-bold text-ink tabular-nums" data-test-selector="pos-cart-bar-total">
              {formatMoney(totals.total)}
            </span>
          </span>
        </div>

        <Button
          onClick={onOpen}
          data-test-selector="pos-cart-open"
          className={cn(CONTROL_HEIGHT, "shrink-0 px-5 font-semibold shadow-card")}
        >
          {t("screen.viewCart")}
        </Button>
      </div>
    </div>
  );
}
