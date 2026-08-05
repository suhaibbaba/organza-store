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
// So a product with variants is drawn as a card with another card behind it —
// tinted, with a sliver showing above its top edge — and points forward with
// a chevron instead of offering a plus. The tint is the brand's own secondary,
// the same one the cart and the back button use, kept faint: a list of ten
// results has to stay calm, and the difference has to survive being glanced
// at rather than read. Nothing changes size, so the rows still scan as one
// list.
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
          <li key={product.id} className={product.hasVariants ? "pt-1" : undefined}>
            <button
              type="button"
              disabled={soldOut || pendingId !== null}
              onClick={() => onSelect(product)}
              className={cn(
                "relative flex w-full items-center gap-3 rounded-xl border border-border p-3 text-start transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                product.hasVariants
                  ? [
                      "bg-secondary hover:bg-secondary/70",
                      // The card behind this one: a sliver of a second card
                      // peeking out above the top edge, inset from both sides
                      // so it reads as stacked rather than as a stray line.
                      // Inset symmetrically and sized with logical properties,
                      // so there is nothing here to mirror in Arabic.
                      "before:absolute before:inset-x-5 before:-top-1 before:h-1.5 before:rounded-t-lg",
                      "before:border before:border-b-0 before:border-border before:bg-secondary before:content-['']",
                    ]
                  : "bg-card hover:bg-accent/60"
              )}
            >
              <ProductThumb src={product.image?.thumbnailUrl} alt={name} className="size-16 rounded-lg" />

              <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <span className="w-full truncate text-base font-medium">{name}</span>
                <span className="flex items-center gap-x-2 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{formatMoney(product.basePrice)}</span>
                  <span className={soldOut ? "text-destructive" : undefined}>
                    · {soldOut ? t("soldOut") : t("inStock", { count: product.stock })}
                  </span>
                </span>
                {/* Replaces the old "· 4 options", and on a line of its own
                    rather than trailing the price. Sharing that line meant the
                    badge fitted in Arabic and wrapped in English — and wrapped
                    only for the pricier rows within one list, so a column of
                    results came out ragged. Its own line is the same height
                    every time, whatever the price, the count or the language. */}
                <VariantKindBadge product={product} />
              </span>

              {pendingId === product.id ? (
                <Spinner className="text-muted-foreground" />
              ) : product.hasVariants ? (
                // rtl:rotate-180 — the chevron points "forward" in the
                // reading direction, which is rightward only in LTR.
                <ChevronRight className="size-5 shrink-0 text-primary rtl:rotate-180" aria-hidden="true" />
              ) : (
                // A plus has no direction to mirror: this one adds to the
                // cart on the spot, and says so the same way in every locale.
                <Plus className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
