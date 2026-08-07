"use client";

import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, Plus } from "lucide-react";
import type { ProductSummary } from "@shared/types/product";
import { localize } from "@/lib/i18n-content";
import { cn } from "@/lib/utils";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { ProductThumb } from "@/components/sell/product-thumb";
import { VariantKindBadge } from "@/components/sell/variant-kind-badge";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { StockBadge } from "@/components/ui/stock-badge";

interface SearchResultsProps {
  results: ProductSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
  // Id of the row the cashier just tapped, while its details load.
  pendingId: string | null;
  onSelect: (product: ProductSummary) => void;
}

// Big, thumb-sized rows: a whole row is the tap target, never a small link
// inside it. Out-of-stock products stay visible but can't be tapped — a
// cashier needs to see that the thing exists and is finished, not wonder
// whether they mistyped.
//
// A row also has to say what tapping it will DO, because there are two
// answers and they used to look identical: a simple product goes straight
// into the cart, one with variants opens a picker asking which. Getting that
// wrong mid-sale means an unexpected sheet over the counter, or a tap that
// silently added something when the cashier expected to choose.
//
// So the two are drawn as two kinds of card. One with variants carries a
// solid accent bar down its leading edge and the faintest wash of the brand's
// secondary, and ends in a chevron: it leads somewhere. A simple one is a
// plain white card that ends in a filled "+": it acts. The bar is what does
// the work at a glance — a single vertical mark in a column of results is
// visible before anything is read — and the tint only has to whisper.
//
// Both cards reserve the same 4px on the leading edge, so a bar appearing
// never nudges a thumbnail sideways and the list still scans as one column.
// Both action marks are the same 44px circle, and the whole row stays the tap
// target, so neither is a small thing to aim at.
export function SearchResults({ results, isLoading, isError, pendingId, onSelect }: SearchResultsProps) {
  const t = useTranslations("sell.search");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  if (isError) {
    return <Alert variant="destructive">{t("error")}</Alert>;
  }

  if (isLoading) {
    return (
      <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Spinner />
        {t("searching")}
      </p>
    );
  }

  if (results && results.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {(results ?? []).map((product) => {
        const name = localize(product.name, locale);
        const soldOut = product.stock <= 0;

        return (
          <li key={product.id}>
            <button
              type="button"
              disabled={soldOut || pendingId !== null}
              onClick={() => onSelect(product)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border border-border p-3 text-start transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                // border-s-* is the logical side, so the bar sits on the
                // leading edge and swaps to the right of the card in Arabic
                // with nothing to mirror by hand. The plain card reserves the
                // same width in transparent, which is what keeps every
                // thumbnail in the list on one vertical line.
                "border-s-4",
                product.hasVariants
                  ? "border-s-primary bg-secondary/40 hover:bg-secondary/70"
                  : "border-s-transparent bg-card hover:bg-accent/60"
              )}
            >
              <ProductThumb src={product.image?.thumbnailUrl} alt={name} className="size-16 rounded-lg" />

              <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <span className="w-full truncate text-base font-medium">{name}</span>

                {/* The price leads and the stock follows it — one figure to
                    read and one thing to check, rather than two competing for
                    the same glance. The check is a coloured badge rather than
                    a quiet grey count: "can I sell this" is the question a
                    cashier is actually asking of a search result, and red /
                    amber / green answers it before the row is read. */}
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-foreground">
                    {formatMoney(product.basePrice)}
                  </span>
                  <StockBadge stock={product.stock} trackLowStock={product.trackLowStock} showCount />
                </span>

                {/* On a line of its own: sharing the price line, it fitted in
                    Arabic and wrapped in English — and wrapped only for the
                    pricier rows within one list, so a column of results came
                    out ragged. */}
                <VariantKindBadge product={product} />
              </span>

              {/* Both marks are the same 44px circle, in the same place, so
                  the eye lands on one thing and reads which it is. Neither is
                  a control of its own — the whole row is the button, which is
                  a far bigger target than the circle it contains. */}
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full",
                  product.hasVariants
                    ? "border border-primary/25 bg-background text-primary"
                    : "bg-primary text-primary-foreground"
                )}
                aria-hidden="true"
              >
                {pendingId === product.id ? (
                  <Spinner className={product.hasVariants ? "text-primary" : "text-primary-foreground"} />
                ) : product.hasVariants ? (
                  // rtl:rotate-180 — the chevron points "forward" in the
                  // reading direction, which is rightward only in LTR.
                  <ChevronRight className="size-5 rtl:rotate-180" />
                ) : (
                  // A plus has no direction to mirror: this one adds to the
                  // cart on the spot, and says so the same way in every locale.
                  <Plus className="size-5" />
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
