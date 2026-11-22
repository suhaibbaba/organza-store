"use client";

import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import type { ProductSummary } from "@store/shared/types/product";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { SELL_CARD_THUMB_SIZES } from "@/constants/images";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { localize } from "@/lib/i18n-content";
import { cn } from "@/lib/utils";
import { ProductThumb } from "@/components/sell/product-thumb";
import { buttonClassName, CardButton, Spinner, Typography } from "@store/ui";
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
    <CardButton
      onClick={() => onAdd(product)}
      disabled={soldOut || isBusy}
      aria-label={t("add", { name })}
      data-testid={testSelectorFor("pos-product-card", product.id)}
      className={cn(
        "size-full min-w-0 flex-col gap-2.5 rounded-card p-2.5 shadow-card",
        "not-disabled:hover:shadow-card-hover focus-darken disabled:opacity-100",
        isBusy && !soldOut && "cursor-wait",
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
          <Typography as="span" variant="caption" tone="muted" className="min-h-5 truncate">
            {category}
          </Typography>
          <Typography as="span" variant="small" weight="semibold" tone={soldOut ? "muted" : "ink"} className="truncate">
            {name}
          </Typography>
        </div>
        <StockBadge stock={product.stock} trackLowStock={product.trackLowStock} showCount className="max-w-full" />
      </div>

      <div className="flex w-full flex-wrap items-center justify-between gap-2 px-1 pb-0.5">
        <Typography as="span" variant="h3" weight="bold" tone={soldOut ? "muted" : "ink"} className="tabular-nums">
          {formatMoney(product.basePrice)}
        </Typography>
        {!soldOut && (
          <span
            aria-hidden="true"
            data-test-selector={testSelectorFor("pos-product-add", product.id)}
            // The ui button's look on a span: a card that is one button cannot hold a second one.
            className={buttonClassName({
              variant: "secondary",
              className: "pointer-events-none h-9 shrink-0 px-2.5 group-not-disabled:group-hover:bg-primary-50",
            })}
          >
            {isPending ? <Spinner className="text-current" /> : <Plus className="size-4" aria-hidden="true" />}
            {t("addToCart")}
          </span>
        )}
      </div>
    </CardButton>
  );
}
