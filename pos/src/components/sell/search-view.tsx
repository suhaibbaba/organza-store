"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import type { ProductSummary } from "@shared/types/product";
import { SearchResults } from "@/components/sell/search-results";

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
}: SearchViewProps) {
  const t = useTranslations("sell.search");

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
    </section>
  );
}
