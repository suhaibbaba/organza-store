"use client";

import { useTranslations } from "next-intl";
import type { ProductSummary } from "@shared/types/product";
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
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
