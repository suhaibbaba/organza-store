"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { DEFAULT_PAGE } from "@shared/constants/pagination";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { DEFAULT_PRODUCT_FILTERS, PRODUCT_SEARCH_DEBOUNCE_MS } from "@/constants/products";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useProductsQuery } from "@/hooks/use-products";
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
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<ProductListFilters>(DEFAULT_PRODUCT_FILTERS);
  const debouncedSearch = useDebouncedValue(searchInput, PRODUCT_SEARCH_DEBOUNCE_MS);

  const effectiveFilters = useMemo<ProductListFilters>(
    () => ({ ...filters, q: debouncedSearch }),
    [filters, debouncedSearch]
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useProductsQuery(effectiveFilters);
  const { data: settings } = useSettingsQuery();
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
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link href="/products/new">
            <Plus className="size-4" aria-hidden="true" />
            {t("addProduct")}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3">
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
  );
}
