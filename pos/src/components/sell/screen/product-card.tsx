"use client";

import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import type { ProductSummary } from "@organza/shared/types/product";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { SELL_CARD_THUMB_SIZES } from "@/constants/images";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { localize } from "@/lib/i18n-content";
import { cn } from "@/lib/utils";
import { ProductThumb } from "@/components/sell/product-thumb";
import { Spinner } from "@/components/ui/spinner";
import { StockBadge } from "@/components/ui/stock-badge";

interface ProductCardProps {
  product: ProductSummary;
  // This card's full product is being fetched after a tap.
  isPending: boolean;
  // Some card is being fetched — one tap at a time, so a second tap cannot
  // raise a second picker.
  isBusy: boolean;
  onAdd: (product: ProductSummary) => void;
}

// One product in the grid, drawn as a card of its own: white, a hairline
// border, 16px corners and the small lift; the photo in a 12px-cornered square
// inside it, the name, a tinted stock pill with the count, then the price and
// a compact emerald "Add to cart" pill. Hover strengthens the border and the
// lift; keyboard focus draws the emerald ring. The WHOLE card is the button — a cashier taps
// the dress they see — and a product with options opens the picker from it
// the same way. The pill is drawn, not a second button.
//
// Sold out stays on the grid — a cashier asked for it should see that it is
// gone rather than wonder whether it exists — dimmed, with the red "sold out"
// pill, no add pill, and the button disabled.
export function ProductCard({ product, isPending, isBusy, onAdd }: ProductCardProps) {
  const t = useTranslations("sell.screen");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  const name = localize(product.name, locale);
  const category = product.category ? localize(product.category.name, locale) : null;
  const soldOut = product.stock <= 0;

  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      disabled={soldOut || isBusy}
      aria-label={t("add", { name })}
      data-test-selector={testSelectorFor("pos-product-card", product.id)}
      className={cn(
        "group flex size-full min-w-0 flex-col gap-2.5 rounded-card border border-border bg-card p-2.5 text-start shadow-sm",
        "transition-[border-color,box-shadow] not-disabled:hover:border-border-strong not-disabled:hover:shadow-md",
        "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed",
        isBusy && !soldOut && "cursor-wait"
      )}
    >
      <ProductThumb
        src={product.image?.thumbnailUrl}
        alt=""
        sizes={SELL_CARD_THUMB_SIZES}
        className={cn("aspect-square w-full rounded-photo bg-soft", soldOut && "opacity-60")}
      />

      <div className="flex w-full min-w-0 flex-1 flex-col items-start gap-1.5 px-1">
        <div className="flex w-full min-w-0 flex-col">
          {/* min-h keeps the rows level when a product has no shelf (a quick
              sale not yet completed). */}
          <span className="min-h-5 truncate text-xs text-muted-foreground">{category}</span>
          <span className={cn("truncate text-sm font-semibold", soldOut && "text-muted-foreground")}>{name}</span>
        </div>
        <StockBadge stock={product.stock} trackLowStock={product.trackLowStock} showCount className="max-w-full" />
      </div>

      <div className="flex w-full flex-wrap items-center justify-between gap-2 px-1 pb-0.5">
        <span className={cn("text-base font-bold tabular-nums", soldOut && "text-muted-foreground")}>
          {formatMoney(product.basePrice)}
        </span>
        {!soldOut && (
          <span
            aria-hidden="true"
            data-test-selector={testSelectorFor("pos-product-add", product.id)}
            // Drawn, not a second button (the whole card is the button), so
            // it can be smaller than the 44px floor.
            className={cn(
              "inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-control border border-primary-border bg-primary-soft px-2.5 text-xs font-semibold text-primary transition-colors",
              "group-not-disabled:group-hover:border-primary group-not-disabled:group-hover:bg-primary group-not-disabled:group-hover:text-primary-foreground"
            )}
          >
            {isPending ? <Spinner /> : <Plus className="size-4" />}
            {t("addToCart")}
          </span>
        )}
      </div>
    </button>
  );
}
