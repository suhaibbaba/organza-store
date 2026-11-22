"use client";

import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import type { ProductSummary } from "@store/shared/types/product";
import { Alert, Button, Spinner, Typography } from "@store/ui";
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
        <div className="flex items-center justify-center gap-2 py-16">
          <Spinner />
          <Typography variant="small" tone="muted">
            {t("browse.loading")}
          </Typography>
        </div>
      ) : products && products.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 px-4 py-14 text-center"
          data-test-selector="pos-products-empty"
        >
          <Typography variant="small" tone="muted">
            {isSearching ? t("browse.emptySearch") : t("browse.empty")}
          </Typography>
          <div className="flex flex-wrap justify-center gap-2">
            {isFiltered && (
              <Button variant="secondary" onClick={onClearFilters} className={"px-4"}>
                {t("browse.clearFilters")}
              </Button>
            )}
            {isSearching && onQuickSell && (
              <Button
                variant="secondary"
                onClick={onQuickSell}
                icon={<Zap className="size-4 text-warning-700" aria-hidden="true" />}
                className={"px-4"}
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
              className={"mx-auto px-5"}
            >
              {t("browse.showMore")}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
