"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft, ShoppingCart, Zap } from "lucide-react";
import type { ProductSummary } from "@organza/shared/types/product";
import { SearchResults } from "@/components/sell/search-results";
import { Button } from "@/components/ui/button";

interface SearchViewProps {
  query: string;
  // How many pieces are waiting in the cart behind this view, shown on the
  // way back so it is obvious the sale is still there.
  cartItemCount: number;
  results: ProductSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
  pendingId: string | null;
  onSelect: (product: ProductSummary) => void;
  onBack: () => void;
  // Offered only when the search came back with nothing, and only to somebody
  // who may quick-sell (spec.md "Quick sell"): "we looked and it isn't there"
  // is the exact moment the piece in the cashier's hand needs selling anyway.
  // Undefined leaves the empty state exactly as it was.
  onQuickSell?: () => void;
}

// Searching is a place the cashier goes, not something that quietly happens
// to the cart.
//
// The results used to replace the cart with no explanation, and the only way
// out was the small ✕ inside the search field — so the usual reaction to
// "where did my sale go" was to start over. This says where you are in a
// heading and gives the way back its own full-width row at the top, above
// the results, where a thumb reaching for the first result finds it anyway.
export function SearchView({
  query,
  cartItemCount,
  results,
  isLoading,
  isError,
  pendingId,
  onSelect,
  onBack,
  onQuickSell,
}: SearchViewProps) {
  const t = useTranslations("sell.search");
  const tQuickSell = useTranslations("sell.quickSell");
  // Nothing matched — as opposed to still looking, or having failed to look.
  const foundNothing = !isLoading && !isError && results?.length === 0;

  return (
    <section aria-labelledby="pos-search-heading" className="flex flex-col gap-3">
      {/* Phone only. From `lg` the cart is a column of its own sitting right
          beside these results, so "back to the sale" would point at
          something already on screen and its count would repeat a total the
          cashier can read. Clearing the box (or Escape) is the way out
          there. */}
      <button
        type="button"
        onClick={onBack}
        className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-secondary px-3 text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        {/* The arrow means "back", which points against the reading
            direction — leftward in English, rightward in Arabic. */}
        <ArrowLeft className="size-5 shrink-0 rtl:rotate-180" aria-hidden="true" />
        <span className="flex-1 text-start text-base font-medium">{t("backToCart")}</span>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-background/70 px-3 py-1 text-sm font-semibold">
          <ShoppingCart className="size-4" aria-hidden="true" />
          <span className="tabular-nums">{t("cartCount", { count: cartItemCount })}</span>
        </span>
      </button>

      <h2 id="pos-search-heading" className="px-1 text-base font-semibold">
        {t("resultsTitle", { query })}
      </h2>

      <SearchResults
        results={results}
        isLoading={isLoading}
        isError={isError}
        pendingId={pendingId}
        onSelect={onSelect}
      />

      {/* Under the "nothing found" line, where the cashier is already
          looking, and phrased as the way forward rather than as a feature:
          the piece is in their hand and the customer is waiting. */}
      {foundNothing && onQuickSell && (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">{tQuickSell("emptyPrompt")}</p>
          <Button
            type="button"
            variant="outline"
            onClick={onQuickSell}
            data-test-selector="pos-quick-sell-from-search"
            className="h-12 w-full"
          >
            <Zap aria-hidden="true" />
            {tQuickSell("open")}
          </Button>
        </div>
      )}
    </section>
  );
}
