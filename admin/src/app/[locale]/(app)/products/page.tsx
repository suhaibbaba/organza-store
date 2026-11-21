"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { SegmentedControl, TotalBadge, Typography, buttonClassName, type TableSort } from "@store/ui";
import { DEFAULT_PAGE } from "@store/shared/constants/pagination";
import { can } from "@store/shared/lib/permissions";
import { Link } from "@/i18n/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";
import { DEFAULT_PRODUCT_FILTERS, PRODUCT_LIST_URL_PARAMS, PRODUCT_SEARCH_DEBOUNCE_MS } from "@/constants/products";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useUrlSearch } from "@/hooks/use-url-search";
import { useNeedsCompletingCountQuery, useProductsQuery } from "@/hooks/use-products";
import { ProductSearch } from "@/components/products/product-search";
import {
  ProductCategoryFilter,
  ProductFilterChips,
  ProductFilters,
  countProductFilters,
} from "@/components/products/product-filters";
import { ProductTable } from "@/components/products/product-table";
import { ProductListEmpty, ProductListError } from "@/components/products/product-list-states";
import type { ProductFiltersValue, ProductListFilters, ProductSortValue } from "@/types/product";

export default function ProductsPage() {
  const t = useTranslations("products");
  const { user } = useSession();
  const [filters, changeFilters] = useUrlFilters(DEFAULT_PRODUCT_FILTERS, PRODUCT_LIST_URL_PARAMS);
  const [searchInput, setSearchInput] = useUrlSearch(
    filters.q,
    (q) => changeFilters({ q, page: DEFAULT_PAGE }),
    PRODUCT_SEARCH_DEBOUNCE_MS
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useProductsQuery(filters);
  // The "needs completing" queue (rule 23), offered only to whoever can clear it.
  const canComplete = can(user, "product.complete");
  const { data: needsCompletingCount } = useNeedsCompletingCountQuery(canComplete);
  const needsCompleting = filters.completeness === "needs_completing";

  const filtersValue: ProductFiltersValue = {
    categoryId: filters.categoryId,
    status: filters.status,
    stock: filters.stock,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
  };
  const sortValue: ProductSortValue = { sortBy: filters.sortBy, sortDir: filters.sortDir };
  const hasAnyFilter = countProductFilters(filtersValue) > 0 || filters.q.trim().length > 0;

  const tableSort: TableSort = {
    key: filters.sortBy,
    dir: filters.sortDir,
    onChange: (key, dir) =>
      changeFilters(
        key === null
          ? { sortBy: DEFAULT_PRODUCT_FILTERS.sortBy, sortDir: DEFAULT_PRODUCT_FILTERS.sortDir, page: DEFAULT_PAGE }
          : { sortBy: key as ProductListFilters["sortBy"], sortDir: dir, page: DEFAULT_PAGE }
      ),
  };

  const products = data?.products ?? [];

  return (
    <PageContainer>
      <PageHeader
        name="products"
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Link href="/products/new" data-test-selector="add-product" className={buttonClassName({ className: "shrink-0" })}>
            <Plus className="size-4" aria-hidden="true" />
            {t("addProduct")}
          </Link>
        }
      />

      <div className="flex flex-col gap-4">
        {/* A tab, not a filter: a quick-sold piece has no category, so the category filter can never find it. Hidden at zero. */}
        {canComplete && (needsCompleting || (needsCompletingCount ?? 0) > 0) && (
          <div className="flex flex-col gap-2">
            <SegmentedControl
              data-testid="products-completeness"
              label={t("title")}
              value={needsCompleting ? "needs-completing" : "all"}
              options={[
                { value: "all", label: t("completeness.all") },
                {
                  value: "needs-completing",
                  label: t("completeness.needsCompleting", { count: needsCompletingCount ?? 0 }),
                },
              ]}
              onChange={(value) =>
                changeFilters({ completeness: value === "needs-completing" ? "needs_completing" : "all", page: DEFAULT_PAGE })
              }
            />
            {needsCompleting && (
              <Typography variant="small" tone="muted">
                {t("completeness.hint")}
              </Typography>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-64 flex-1 sm:max-w-md">
              <ProductSearch
                value={searchInput}
                onChange={setSearchInput}
              />
            </div>
            <ProductCategoryFilter
              value={filters.categoryId}
              onChange={(categoryId) => changeFilters({ categoryId, page: DEFAULT_PAGE })}
            />
            <ProductFilters
              value={filtersValue}
              sort={sortValue}
              onApply={(next, sort) => changeFilters({ ...next, ...sort, page: DEFAULT_PAGE })}
            />
            {data?.meta && (
              <div className="ms-auto flex h-(--control-h) items-center">
                <TotalBadge data-testid="products-count" total={data.meta.total} />
              </div>
            )}
          </div>
          <ProductFilterChips value={filtersValue} onChange={(next) => changeFilters({ ...next, page: DEFAULT_PAGE })} />
        </div>

        {isError ? (
          <ProductListError error={error} onRetry={() => void refetch()} />
        ) : !isLoading && products.length === 0 ? (
          <ProductListEmpty hasFilters={hasAnyFilter} />
        ) : (
          <ProductTable
            products={products}
            meta={data?.meta ?? null}
            isLoading={isLoading}
            isRefreshing={isFetching && !isLoading}
            sort={tableSort}
            onPageChange={(page) => changeFilters({ page })}
            onPageSizeChange={(pageSize) => changeFilters({ pageSize, page: DEFAULT_PAGE })}
          />
        )}
      </div>
    </PageContainer>
  );
}
