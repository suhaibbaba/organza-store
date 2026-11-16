"use client";

import { useTranslations } from "next-intl";
import type { ProductSummary } from "@organza/shared/types/product";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { BrowserProductCard } from "@/components/sell/browser/browser-product-card";

interface BrowserProductGridProps {
  products: ProductSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
  // A search inside the drawer that found nothing gets a different empty
  // state from an empty shelf, and a way out of the narrowing that caused it.
  isSearching: boolean;
  isFiltered: boolean;
  onClearFilters: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onShowMore: () => void;
  pendingId: string | null;
  onSelect: (product: ProductSummary) => void;
}

// The picking side of the drawer: photos, in a grid, two-up on a phone and
// wider as the screen allows.
export function BrowserProductGrid({
  products,
  isLoading,
  isError,
  isSearching,
  isFiltered,
  onClearFilters,
  hasNextPage,
  isFetchingNextPage,
  onShowMore,
  pendingId,
  onSelect,
}: BrowserProductGridProps) {
  const t = useTranslations("sell.browse");

  if (isError) {
    return (
      <div className="p-4">
        <Alert variant="destructive">{t("error")}</Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Spinner />
        {t("loading")}
      </p>
    );
  }

  if (products && products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">{isSearching ? t("emptySearch") : t("empty")}</p>
        {/* The commonest way to an empty grid is a search typed while a
            category is still selected. Rather than leaving the cashier to
            work that out, the way back is a button. */}
        {isFiltered && (
          <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
            {t("clearFilters")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      {/* Two up on a phone, fixed — that is the one width where the answer is
          known and the shelf sidebar has already taken its bite out of the
          panel. Above that the column count is left to the grid: this lives
          inside a drawer whose width is its own (92vw, capped, less the
          sidebar), so a viewport breakpoint was guessing at a width it could
          not see, and gave three 117px cards at the very size a photo starts
          being worth looking at. auto-fill with a floor fits as many columns
          of at least 8.5rem as the panel actually has room for. */}
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]">
        {(products ?? []).map((product, index) => (
          <li key={product.id} className="flex">
            <BrowserProductCard
              product={product}
              index={index}
              isPending={pendingId === product.id}
              isBusy={pendingId !== null}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>

      {/* Paged rather than endless: an infinite scroll on a till is a way to
          lose your place mid-sale, and the API is never asked for an
          unbounded list either (CLAUDE.md rule 15). */}
      {hasNextPage && (
        <Button
          type="button"
          variant="outline"
          onClick={onShowMore}
          disabled={isFetchingNextPage}
          className="mx-auto w-full max-w-xs"
        >
          {isFetchingNextPage ? <Spinner /> : null}
          {t("showMore")}
        </Button>
      )}
    </div>
  );
}
