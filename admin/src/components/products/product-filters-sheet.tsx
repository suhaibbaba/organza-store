"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select } from "@/components/ui/select";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const { data: categoryTree } = useCategoriesQuery();

  const categoryOptions = categoryTree ? flattenCategoryTree(categoryTree) : [];

  // Re-sync the draft with the applied filters on open, so reopening after
  // Apply/Reset reflects the current state rather than a stale in-progress edit.
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
        type="button"
        variant="outline"
        onClick={() => handleOpenChange(true)}
        data-test-selector="product-filters-open"
        className="relative shrink-0 px-4"
      >
        <SlidersHorizontal className="size-5" aria-hidden="true" />
        {t("trigger")}
        {activeCount > 0 && (
          <span className="absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent name="product-filters" side="end" closeLabel={tCommon("close")}>
          <SheetHeader>
            <SheetTitle>{t("title")}</SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-category">{t("category")}</Label>
              <Select
                id="filter-category"
                value={draft.categoryId ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value || null }))}
              >
                <option value="">{t("allCategories")}</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {"  ".repeat(c.depth)}
                    {localize(c.name, locale)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-status">{t("status")}</Label>
              <Select
                id="filter-status"
                value={draft.status ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, status: (e.target.value || null) as ProductFiltersValue["status"] }))
                }
              >
                <option value="">{t("statusAll")}</option>
                <option value="active">{t("statusActive")}</option>
                <option value="hidden">{t("statusHidden")}</option>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-stock">{t("stock")}</Label>
              <Select
                id="filter-stock"
                value={draft.stock ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, stock: (e.target.value || null) as ProductFiltersValue["stock"] }))
                }
              >
                <option value="">{t("stockAll")}</option>
                <option value="in_stock">{t("stockInStock")}</option>
                <option value="out_of_stock">{t("stockOutOfStock")}</option>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t("priceRange")}</Label>
              <div className="flex items-center gap-3">
                <NumericInput
                  allowDecimal
                  placeholder={t("priceMin")}
                  aria-label={t("priceMin")}
                  value={draft.priceMin}
                  onChange={(e) => setDraft((d) => ({ ...d, priceMin: e.target.value }))}
                />
                <span className="text-muted-foreground">–</span>
                <NumericInput
                  allowDecimal
                  placeholder={t("priceMax")}
                  aria-label={t("priceMax")}
                  value={draft.priceMax}
                  onChange={(e) => setDraft((d) => ({ ...d, priceMax: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 p-5 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={handleReset} data-test-selector="product-filters-reset">
              {t("reset")}
            </Button>
            <Button type="button" className="flex-1" onClick={handleApply} data-test-selector="product-filters-apply">
              {t("apply")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
