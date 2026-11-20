"use client";

import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import type { ProductSummary } from "@organza/shared/types/product";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { CONTROL_HEIGHT, SCREEN_CARD } from "@/components/sell/screen/control-styles";
import { ProductCard } from "@/components/sell/screen/product-card";
import { SectionTitle } from "@/components/sell/screen/section-title";

interface ProductGridProps {
  products: ProductSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
  isSearching: boolean;
  // A category is selected — an empty answer offers to drop it.
  isFiltered: boolean;
  onClearFilters: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onShowMore: () => void;
  pendingId: string | null;
  onAdd: (product: ProductSummary) => void;
  // Offered when a search found nothing (spec.md "Quick sell"); absent for an
  // account that may not quick-sell.
  onQuickSell?: () => void;
}

const TITLE_ID = "pos-products-title";

// The products card: its title and the grid — 2 per row
// on a phone, 3 from 600px (and beside the cart from 1000px), 4 from 1200px
// and 5 from 1400px.
export function ProductGrid({
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
  onAdd,
  onQuickSell,
}: ProductGridProps) {
  const t = useTranslations("sell");

  return (
    <section aria-labelledby={TITLE_ID} className={cn(SCREEN_CARD, "flex flex-col gap-4 p-4 desk:p-5")}>
      <SectionTitle id={TITLE_ID}>{t("screen.productsTitle")}</SectionTitle>

      {isError ? (
        <Alert variant="destructive">{t("browse.error")}</Alert>
      ) : isLoading ? (
        <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Spinner />
          {t("browse.loading")}
        </p>
      ) : products && products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-14 text-center" data-test-selector="pos-products-empty">
          <p className="text-sm text-muted-foreground">{isSearching ? t("browse.emptySearch") : t("browse.empty")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {isFiltered && (
              <button
                type="button"
                onClick={onClearFilters}
                className={cn(
                  CONTROL_HEIGHT,
                  "rounded-control border border-border bg-card px-4 text-sm font-medium hover:bg-soft"
                )}
              >
                {t("browse.clearFilters")}
              </button>
            )}
            {isSearching && onQuickSell && (
              <button
                type="button"
                onClick={onQuickSell}
                className={cn(
                  CONTROL_HEIGHT,
                  "inline-flex items-center gap-2 rounded-control border border-quick-border bg-quick px-4 text-sm font-medium text-quick-foreground"
                )}
              >
                <Zap className="size-4" aria-hidden="true" />
                {t("quickSell.open")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <ul
            className="grid grid-cols-2 gap-3 tab:grid-cols-3 desk:gap-4 wide:grid-cols-4 xwide:grid-cols-5"
            data-test-selector="pos-product-grid"
          >
            {(products ?? []).map((product) => (
              <li key={product.id} className="min-w-0">
                <ProductCard
                  product={product}
                  isPending={pendingId === product.id}
                  isBusy={pendingId !== null}
                  onAdd={onAdd}
                />
              </li>
            ))}
          </ul>

          {/* Paged, never endless (CLAUDE.md rule 15). */}
          {hasNextPage && (
            <button
              type="button"
              onClick={onShowMore}
              disabled={isFetchingNextPage}
              className={cn(
                CONTROL_HEIGHT,
                "mx-auto inline-flex items-center gap-2 rounded-control border border-border bg-card px-5 text-sm font-medium hover:bg-soft disabled:opacity-60"
              )}
            >
              {isFetchingNextPage && <Spinner />}
              {t("browse.showMore")}
            </button>
          )}
        </>
      )}
    </section>
  );
}
