"use client";

import { MoneyField } from "@/components/fields/money-field";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { Button, Drawer, FormField, Select } from "@store/ui";
import { fieldTestSelector } from "@organza/shared/lib/testSelector";
import { useCategoriesQuery } from "@/hooks/use-categories";
import { flattenCategoryTree } from "@/lib/api/categories";
import { localize } from "@/lib/i18n-content";
import { DEFAULT_PRODUCT_FILTERS } from "@/constants/products";
import type { ProductListFilters } from "@/types/product";

export interface ProductFiltersValue {
  categoryId: string | null;
  status: ProductListFilters["status"];
  stock: ProductListFilters["stock"];
  priceMin: string;
  priceMax: string;
}

interface ProductFiltersSheetProps {
  value: ProductFiltersValue;
  onApply: (value: ProductFiltersValue) => void;
  activeCount: number;
}

export function ProductFiltersSheet({ value, onApply, activeCount }: ProductFiltersSheetProps) {
  const t = useTranslations("products.filters");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const { data: categoryTree } = useCategoriesQuery();

  const categoryOptions = categoryTree ? flattenCategoryTree(categoryTree) : [];

  // Re-sync on open so a reopened sheet shows the applied filters, not a stale draft.
  function handleOpenChange(next: boolean) {
    if (next) setDraft(value);
    setOpen(next);
  }

  function handleApply() {
    onApply(draft);
    setOpen(false);
  }

  function handleReset() {
    const reset: ProductFiltersValue = {
      categoryId: null,
      status: null,
      stock: null,
      priceMin: DEFAULT_PRODUCT_FILTERS.priceMin,
      priceMax: DEFAULT_PRODUCT_FILTERS.priceMax,
    };
    setDraft(reset);
    onApply(reset);
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => handleOpenChange(true)}
        data-test-selector="product-filters-open"
        className="relative shrink-0 px-4"
        icon={<SlidersHorizontal className="size-5" aria-hidden="true" />}
      >
        {t("trigger")}
        {activeCount > 0 && (
          <span className="absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center rounded-pill bg-primary-600 text-micro font-semibold text-ink-inverse">
            {activeCount}
          </span>
        )}
      </Button>

      <Drawer
        data-testid="sheet-product-filters"
        open={open}
        onOpenChange={handleOpenChange}
        title={t("title")}
        descriptionKey="products.filters.title"
        footer={
          <>
            <Button variant="secondary" onClick={handleReset} data-test-selector="product-filters-reset">
              {t("reset")}
            </Button>
            <Button onClick={handleApply} data-test-selector="product-filters-apply">
              {t("apply")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <FormField label="products.filters.category" htmlFor="filter-category">
            <Select
              id="filter-category"
              data-testid={fieldTestSelector("filter-category")}
              value={draft.categoryId ?? ""}
              placeholder={t("allCategories")}
              options={categoryOptions.map((c) => ({
                value: c.id,
                label: `${"  ".repeat(c.depth)}${localize(c.name, locale)}`,
              }))}
              onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value || null }))}
            />
          </FormField>

          <FormField label="products.filters.status" htmlFor="filter-status">
            <Select
              id="filter-status"
              data-testid={fieldTestSelector("filter-status")}
              value={draft.status ?? ""}
              placeholder={t("statusAll")}
              options={[
                { value: "active", label: t("statusActive") },
                { value: "hidden", label: t("statusHidden") },
              ]}
              onChange={(e) =>
                setDraft((d) => ({ ...d, status: (e.target.value || null) as ProductFiltersValue["status"] }))
              }
            />
          </FormField>

          <FormField label="products.filters.stock" htmlFor="filter-stock">
            <Select
              id="filter-stock"
              data-testid={fieldTestSelector("filter-stock")}
              value={draft.stock ?? ""}
              placeholder={t("stockAll")}
              options={[
                { value: "in_stock", label: t("stockInStock") },
                { value: "out_of_stock", label: t("stockOutOfStock") },
              ]}
              onChange={(e) =>
                setDraft((d) => ({ ...d, stock: (e.target.value || null) as ProductFiltersValue["stock"] }))
              }
            />
          </FormField>

          <FormField label="products.filters.priceRange" htmlFor="filter-price-min">
            <div className="flex items-center gap-3">
              <MoneyField
                id="filter-price-min"
                placeholder={t("priceMin")}
                aria-label={t("priceMin")}
                value={draft.priceMin}
                onChange={(e) => setDraft((d) => ({ ...d, priceMin: e.target.value }))}
              />
              <span className="text-ink-muted">–</span>
              <MoneyField
                placeholder={t("priceMax")}
                aria-label={t("priceMax")}
                value={draft.priceMax}
                onChange={(e) => setDraft((d) => ({ ...d, priceMax: e.target.value }))}
              />
            </div>
          </FormField>
        </div>
      </Drawer>
    </>
  );
}
