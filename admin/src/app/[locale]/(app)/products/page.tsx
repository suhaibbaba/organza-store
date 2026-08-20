"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { DEFAULT_PAGE } from "@organza/shared/constants/pagination";
import { can } from "@organza/shared/lib/permissions";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_PRODUCT_FILTERS, PRODUCT_SEARCH_DEBOUNCE_MS } from "@/constants/products";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useNeedsCompletingCountQuery, useProductsQuery } from "@/hooks/use-products";
import { useSettingsQuery } from "@/hooks/use-settings";
import { ProductSearch } from "@/components/products/product-search";
import { ProductFiltersSheet, type ProductFiltersValue } from "@/components/products/product-filters-sheet";
import { ProductSortSelect } from "@/components/products/product-sort-select";
import { ProductCard } from "@/components/products/product-card";
import { ProductTable } from "@/components/products/product-table";
import { ProductPagination } from "@/components/products/product-pagination";
import {
  ProductListEmpty,
  ProductListError,
  ProductListLoading,
  ProductListSpinnerOverlay,
} from "@/components/products/product-list-states";
import type { ProductListFilters } from "@/types/product";

export default function ProductsPage() {
  const t = useTranslations("products");
  const { user } = useSession();
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<ProductListFilters>(DEFAULT_PRODUCT_FILTERS);
  const debouncedSearch = useDebouncedValue(searchInput, PRODUCT_SEARCH_DEBOUNCE_MS);

  const effectiveFilters = useMemo<ProductListFilters>(
    () => ({ ...filters, q: debouncedSearch }),
    [filters, debouncedSearch]
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useProductsQuery(effectiveFilters);
  const { data: settings } = useSettingsQuery();
  // The "needs completing" queue (spec.md "Quick sell"). Only offered to
  // whoever can actually clear it, so an Employee is not shown a pile of work
  // they cannot do anything about.
  const canComplete = can(user, "product.complete");
  const { data: needsCompletingCount } = useNeedsCompletingCountQuery(canComplete);
  const needsCompleting = filters.completeness === "needs_completing";
  const currency = settings?.currency ?? "ILS";

  const filtersValue: ProductFiltersValue = {
    categoryId: filters.categoryId,
    status: filters.status,
    stock: filters.stock,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
  };
  const activeFilterCount = [
    filters.categoryId,
    filters.status,
    filters.stock,
    filters.priceMin,
    filters.priceMax,
  ].filter(Boolean).length;
  const hasAnyFilter = activeFilterCount > 0 || debouncedSearch.trim().length > 0;

  function updatePage(page: number) {
    setFilters((f) => ({ ...f, page }));
  }

  function applyFilters(next: ProductFiltersValue) {
    setFilters((f) => ({ ...f, ...next, page: DEFAULT_PAGE }));
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    setFilters((f) => ({ ...f, page: DEFAULT_PAGE }));
  }

  function handleSortChange(sortBy: ProductListFilters["sortBy"], sortDir: ProductListFilters["sortDir"]) {
    setFilters((f) => ({ ...f, sortBy, sortDir, page: DEFAULT_PAGE }));
  }

  const products = data?.products ?? [];

  return (
    <PageContainer>
      <PageHeader
        name="products"
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild size="sm" className="shrink-0" data-test-selector="add-product">
            <Link href="/products/new">
              <Plus className="size-4" aria-hidden="true" />
              {t("addProduct")}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {/* The queue gets a tab of its own rather than a checkbox inside
              the filters sheet, and deliberately: a quick-sold piece has no
              category, so it is invisible to the category filter sitting two
              controls away — the one place somebody would think to look for
              it. A tab on the surface, carrying its own count, is what stops
              a season of them being forgotten.

              Hidden entirely once the count is zero and nothing is filtered
              by it, so the ordinary products screen keeps the shape it has
              always had in a shop that never quick-sells. */}
          {canComplete && (needsCompleting || (needsCompletingCount ?? 0) > 0) && (
            <Tabs
              value={filters.completeness}
              onValueChange={(value) =>
                setFilters((f) => ({
                  ...f,
                  completeness: value as ProductListFilters["completeness"],
                  page: DEFAULT_PAGE,
                }))
              }
            >
              <TabsList>
                <TabsTrigger value="all">{t("completeness.all")}</TabsTrigger>
                <TabsTrigger value="needs_completing" data-test-selector="products-needs-completing-tab">
                  {t("completeness.needsCompleting", { count: needsCompletingCount ?? 0 })}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Said in plain words above the list, because a screen that has
              silently changed what it is showing is how somebody concludes
              the catalogue has lost half its products. */}
          {needsCompleting && <p className="text-sm text-muted-foreground">{t("completeness.hint")}</p>}

          <ProductSearch value={searchInput} onChange={handleSearchChange} />
          <div className="flex gap-3">
            <div className="flex-1">
              <ProductSortSelect sortBy={filters.sortBy} sortDir={filters.sortDir} onChange={handleSortChange} />
            </div>
            <ProductFiltersSheet value={filtersValue} onApply={applyFilters} activeCount={activeFilterCount} />
          </div>
        </div>

        {isLoading ? (
          <ProductListLoading />
        ) : isError ? (
          <ProductListError error={error} onRetry={() => void refetch()} />
        ) : products.length === 0 ? (
          <ProductListEmpty hasFilters={hasAnyFilter} />
        ) : (
          <>
            {isFetching && <ProductListSpinnerOverlay />}

            <div className="flex flex-col gap-3 md:hidden">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} currency={currency} />
              ))}
            </div>

            <div className="hidden md:block">
              <ProductTable products={products} currency={currency} />
            </div>

            {data?.meta && <ProductPagination meta={data.meta} onPageChange={updatePage} />}
          </>
        )}
      </div>
    </PageContainer>
  );
}