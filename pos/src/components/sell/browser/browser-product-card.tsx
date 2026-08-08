"use client";

import { useLocale } from "next-intl";
import { ChevronRight, Plus } from "lucide-react";
import type { ProductSummary } from "@shared/types/product";
import { BROWSE_CARD_STAGGER_MAX, BROWSE_CARD_STAGGER_STEP_MS } from "@/constants/pos";
import { localize } from "@/lib/i18n-content";
import { cn } from "@/lib/utils";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { ProductThumb } from "@/components/sell/product-thumb";
import { VariantKindBadge } from "@/components/sell/variant-kind-badge";
import { Spinner } from "@/components/ui/spinner";
import { StockBadge } from "@/components/ui/stock-badge";

interface BrowserProductCardProps {
  product: ProductSummary;
  // While this card's full product is being fetched, after a tap.
  isPending: boolean;
  // True while any card is loading — one tap at a time, so a second tap
  // can't start a second sheet.
  isBusy: boolean;
  onSelect: (product: ProductSummary) => void;
  // Position in the grid, for the entrance stagger only.
  index: number;
}

// One product in the browser's grid: the photo first, because the photo is
// the whole reason this drawer exists — a silk scarf carries no label to
// scan, and the cashier is looking for the one in their hand.
//
// Everything under the photo is the same three facts a search result gives,
// in the same order and drawn by the same components: the name, the price,
// and whether it can be sold at all. The stock badge is red / amber / green
// AND spells its state out in words (StockBadge), so nothing here is said in
// colour alone.
//
// A product with variants is marked exactly as it is in the search results —
// the accent bar down the leading edge, the faint secondary wash, the
// chevron rather than the "+" — because tapping it does the same thing there
// and here: it opens the picker instead of adding. A cashier should never
// have to learn a second visual language for the same two outcomes.
export function BrowserProductCard({ product, isPending, isBusy, onSelect, index }: BrowserProductCardProps) {
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  const name = localize(product.name, locale);
  const soldOut = product.stock <= 0;

  return (
    <button
      type="button"
      disabled={soldOut || isBusy}
      onClick={() => onSelect(product)}
      // The stagger is capped: past the first screenful the delay would be
      // longer than the scroll that revealed the card, so late cards arrive
      // at once instead of trickling in.
      style={{ animationDelay: `${Math.min(index, BROWSE_CARD_STAGGER_MAX) * BROWSE_CARD_STAGGER_STEP_MS}ms` }}
      className={cn(
        "pos-browse-card group relative flex w-full flex-col overflow-hidden rounded-xl border border-border text-start",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        // Press feedback: a transform, so it is composited rather than
        // re-laying the grid out, and dropped entirely when the phone asks
        // for less motion.
        "transition-transform duration-100 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
        "border-s-4",
        product.hasVariants
          ? "border-s-primary bg-secondary/40 hover:bg-secondary/70"
          : "border-s-transparent bg-card hover:bg-accent/60"
      )}
    >
      <ProductThumb
        src={product.image?.thumbnailUrl}
        alt={name}
        className="aspect-square w-full"
        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
      />

      {/* The same 44px-circle marks the search results use, in the same two
          shapes: a "+" acts, a chevron leads somewhere. Over the photo's
          trailing corner rather than in a row of its own, so the card stays
          as short as its text — the card itself is the tap target, and it is
          far larger than this. */}
      <span
        className={cn(
          "absolute end-1.5 top-1.5 flex size-9 items-center justify-center rounded-full shadow-sm",
          product.hasVariants ? "border border-primary/25 bg-background text-primary" : "bg-primary text-primary-foreground"
        )}
        aria-hidden="true"
      >
        {isPending ? (
          <Spinner className={product.hasVariants ? "text-primary" : "text-primary-foreground"} />
        ) : product.hasVariants ? (
          <ChevronRight className="size-4 rtl:rotate-180" />
        ) : (
          <Plus className="size-4" />
        )}
      </span>

      <span className="flex w-full flex-1 flex-col items-start gap-1 p-2">
        {/* Two lines, then an ellipsis: every card in a row stays the same
            height, and a long Arabic name is still readable enough to pick
            from. */}
        <span className="line-clamp-2 w-full text-sm font-medium leading-snug">{name}</span>
        <span className="text-sm font-semibold text-foreground">{formatMoney(product.basePrice)}</span>
        {/* No count here, unlike a search result: a card is half a phone
            wide, and "In stock · 6 left" truncates to "In stock · 6 le…" in
            English and worse in Arabic. The words are what make this readable
            to somebody who cannot separate the three colours, so the words
            are what must survive — and "low stock" already says the only
            thing a count would add at a glance. */}
        <StockBadge stock={product.stock} trackLowStock={product.trackLowStock} size="sm" />
        <VariantKindBadge product={product} />
      </span>
    </button>
  );
}
