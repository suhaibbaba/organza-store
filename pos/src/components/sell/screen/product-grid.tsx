"use client";

import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import type { ProductSummary } from "@store/shared/types/product";
import { cn } from "@/lib/utils";
import { Alert, Button, Spinner } from "@store/ui";
import { CONTROL_HEIGHT } from "@/components/sell/screen/control-styles";
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
  // Offered when a search found nothing (spec.md "Quick sell"); absent for an account that may not quick-sell.
  onQuickSell?: () => void;
}

const TITLE_ID = "pos-products-title";

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
    <section aria-labelledby={TITLE_ID} className="flex flex-col gap-3">
      <SectionTitle id={TITLE_ID}>{t("screen.productsTitle")}</SectionTitle>

      {isError ? (
        <Alert tone="danger">{t("browse.error")}</Alert>
      ) : isLoading ? (
        <p className="flex items-center justify-center gap-2 py-16 text-label text-ink-muted">
          <Spinner />
          {t("browse.loading")}
        </p>
      ) : products && products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-14 text-center" data-test-selector="pos-products-empty">
          <p className="text-label text-ink-muted">{isSearching ? t("browse.emptySearch") : t("browse.empty")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {isFiltered && (
              <Button variant="secondary" onClick={onClearFilters} className={cn(CONTROL_HEIGHT, "px-4")}>
                {t("browse.clearFilters")}
              </Button>
            )}
            {isSearching && onQuickSell && (
              <Button
                variant="secondary"
                onClick={onQuickSell}
                icon={<Zap className="size-4" aria-hidden="true" />}
                className={cn(
                  CONTROL_HEIGHT,
                  "border-warning-300 bg-warning-50 px-4 text-warning-800 hover:border-warning-500 hover:bg-warning-100 hover:text-warning-800"
                )}
              >
                {t("quickSell.open")}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <ul
            className="grid grid-cols-2 gap-3 tab:grid-cols-3 desk:gap-4 xwide:grid-cols-4"
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
            <Button
              variant="secondary"
              onClick={onShowMore}
              disabled={isFetchingNextPage}
              isLoading={isFetchingNextPage}
              className={cn(CONTROL_HEIGHT, "mx-auto px-5")}
            >
              {t("browse.showMore")}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
