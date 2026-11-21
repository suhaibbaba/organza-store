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
import { Spinner } from "@store/ui";
import { StockBadge } from "@/components/sell/stock-badge";

interface ProductCardProps {
  product: ProductSummary;
  // This card's full product is being fetched after a tap.
  isPending: boolean;
  // Some card is being fetched: one tap at a time, so a second tap cannot raise a second picker.
  isBusy: boolean;
  onAdd: (product: ProductSummary) => void;
}

// The whole card is the button (a cashier taps the dress they see); sold out stays on the grid, dimmed and disabled.
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
        "group flex size-full min-w-0 flex-col gap-2.5 rounded-card border border-line bg-surface p-2.5 text-start shadow-card",
        "cursor-pointer transition-[border-color,box-shadow] not-disabled:hover:border-line-strong not-disabled:hover:shadow-card-hover",
        "focus-visible:border-primary-600 focus-darken",
        "disabled:cursor-not-allowed",
        isBusy && !soldOut && "cursor-wait"
      )}
    >
      {/* A numbered shawl is sold by its numbers, so its burned-in photo shows whole. */}
      <ProductThumb
        src={product.markedImage?.thumbnailUrl ?? product.image?.thumbnailUrl}
        alt=""
        sizes={SELL_CARD_THUMB_SIZES}
        fit={product.markedImage ? "contain" : "cover"}
        className={cn("aspect-square w-full rounded-photo bg-sunken", soldOut && "opacity-60")}
      />

      <div className="flex w-full min-w-0 flex-1 flex-col items-start gap-1.5 px-1">
        <div className="flex w-full min-w-0 flex-col">
          {/* min-h keeps the rows level when a product has no shelf (a quick sale not yet completed). */}
          <span className="min-h-5 truncate text-micro text-ink-muted">{category}</span>
          <span className={cn("truncate text-label font-semibold text-ink", soldOut && "text-ink-muted")}>{name}</span>
        </div>
        <StockBadge stock={product.stock} trackLowStock={product.trackLowStock} showCount className="max-w-full" />
      </div>

      <div className="flex w-full flex-wrap items-center justify-between gap-2 px-1 pb-0.5">
        <span className={cn("text-section font-bold text-ink tabular-nums", soldOut && "text-ink-muted")}>
          {formatMoney(product.basePrice)}
        </span>
        {!soldOut && (
          <span
            aria-hidden="true"
            data-test-selector={testSelectorFor("pos-product-add", product.id)}
            // Drawn, not a second button, so it can be smaller than the 44px floor.
            className={cn(
              "inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-control border border-primary-200 bg-primary-50 px-2.5 text-micro font-semibold text-primary-600 transition-colors",
              "group-not-disabled:group-hover:border-primary-600 group-not-disabled:group-hover:bg-primary-600 group-not-disabled:group-hover:text-ink-inverse"
            )}
          >
            {isPending ? <Spinner className="text-current" /> : <Plus className="size-4" />}
            {t("addToCart")}
          </span>
        )}
      </div>
    </button>
  );
}
