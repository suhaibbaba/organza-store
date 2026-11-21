"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { Button, Chip, ChipGroup, Drawer, FormField, Select, Typography } from "@store/ui";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { MoneyField } from "@/components/fields/money-field";
import { useCategoriesQuery } from "@/hooks/use-categories";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { flattenCategoryTree } from "@/lib/api/categories";
import { localize } from "@/lib/i18n-content";
import { PRODUCT_SORT_OPTIONS } from "@/constants/products";
import type {
  ProductCategoryFilterProps,
  ProductFilterChipsProps,
  ProductFiltersProps,
  ProductFiltersValue,
} from "@/types/product";

export const EMPTY_PRODUCT_FILTERS: ProductFiltersValue = {
  categoryId: null,
  status: null,
  stock: null,
  priceMin: "",
  priceMax: "",
};

export function countProductFilters(value: ProductFiltersValue): number {
  return [value.categoryId, value.status, value.stock, value.priceMin || value.priceMax].filter(Boolean).length;
}

function useCategoryOptions() {
  const locale = useLocale();
  const { data: tree } = useCategoriesQuery();
  return (tree ? flattenCategoryTree(tree) : []).map((category) => ({
    value: category.id,
    label: `${"  ".repeat(category.depth)}${localize(category.name, locale)}`,
    name: localize(category.name, locale),
  }));
}

// Category is the filter the shop reaches for most, so desktop gets it in the toolbar, applied at once; phones keep it in the drawer.
export function ProductCategoryFilter({ value, onChange }: ProductCategoryFilterProps) {
  const t = useTranslations("products.filters");
  const categories = useCategoryOptions();
  return (
    <div className="hidden w-60 shrink-0 md:block">
      <Select
        aria-label={t("category")}
        data-testid="products-category"
        value={value ?? ""}
        placeholder={t("allCategories")}
        options={categories.map(({ value: id, label }) => ({ value: id, label }))}
        onChange={(event) => onChange(event.target.value || null)}
      />
    </div>
  );
}

export function ProductFilters({ value, sort, onApply }: ProductFiltersProps) {
  const t = useTranslations("products.filters");
  const tSort = useTranslations("products.sort");
  const categories = useCategoryOptions();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [draftSort, setDraftSort] = useState(sort);
  const activeCount = countProductFilters(value);

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(value);
      setDraftSort(sort);
    }
    setOpen(next);
  }

  function apply(next: ProductFiltersValue) {
    onApply(next, draftSort);
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => handleOpenChange(true)}
        data-test-selector="product-filters-open"
        className="relative shrink-0"
        icon={<SlidersHorizontal className="size-4" aria-hidden="true" />}
      >
        {t("trigger")}
        {activeCount > 0 && (
          <Typography
            variant="caption"
            as="span"
            className="absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center rounded-pill bg-primary-600 text-ink-inverse"
          >
            {activeCount}
          </Typography>
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
            <Button
              variant="secondary"
              onClick={() => apply(EMPTY_PRODUCT_FILTERS)}
              data-test-selector="product-filters-reset"
            >
              {t("reset")}
            </Button>
            <Button onClick={() => apply(draft)} data-test-selector="product-filters-apply">
              {t("apply")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <FormField label="products.sort.label" hint="products.filters.sortHint" htmlFor="filter-sort">
            <Select
              id="filter-sort"
              data-testid="products-sort"
              value={`${draftSort.sortBy}-${draftSort.sortDir}`}
              options={PRODUCT_SORT_OPTIONS.map((option) => ({ value: option.value, label: tSort(option.labelKey) }))}
              onChange={(event) => {
                const option = PRODUCT_SORT_OPTIONS.find((one) => one.value === event.target.value);
                if (option) {
                  setDraftSort({ sortBy: option.sortBy, sortDir: option.sortDir });
                }
              }}
            />
          </FormField>

          <FormField label="products.filters.category" hint="products.filters.categoryHint" htmlFor="filter-category">
            <Select
              id="filter-category"
              data-testid={fieldTestSelector("filter-category")}
              value={draft.categoryId ?? ""}
              placeholder={t("allCategories")}
              options={categories.map(({ value: id, label }) => ({ value: id, label }))}
              onChange={(event) => setDraft((d) => ({ ...d, categoryId: event.target.value || null }))}
            />
          </FormField>

          <FormField label="products.filters.status" hint="products.filters.statusHint" htmlFor="filter-status">
            <Select
              id="filter-status"
              data-testid={fieldTestSelector("filter-status")}
              value={draft.status ?? ""}
              placeholder={t("statusAll")}
              options={[
                { value: "active", label: t("statusActive") },
                { value: "hidden", label: t("statusHidden") },
              ]}
              onChange={(event) =>
                setDraft((d) => ({ ...d, status: (event.target.value || null) as ProductFiltersValue["status"] }))
              }
            />
          </FormField>

          <FormField label="products.filters.stock" hint="products.filters.stockHint" htmlFor="filter-stock">
            <Select
              id="filter-stock"
              data-testid={fieldTestSelector("filter-stock")}
              value={draft.stock ?? ""}
              placeholder={t("stockAll")}
              options={[
                { value: "in_stock", label: t("stockInStock") },
                { value: "out_of_stock", label: t("stockOutOfStock") },
              ]}
              onChange={(event) =>
                setDraft((d) => ({ ...d, stock: (event.target.value || null) as ProductFiltersValue["stock"] }))
              }
            />
          </FormField>

          <FormField label="products.filters.priceRange" hint="products.filters.priceHint" htmlFor="filter-price-min">
            <div className="grid grid-cols-2 gap-3">
              <MoneyField
                id="filter-price-min"
                placeholder={t("priceMin")}
                aria-label={t("priceMin")}
                value={draft.priceMin}
                onChange={(event) => setDraft((d) => ({ ...d, priceMin: event.target.value }))}
              />
              <MoneyField
                placeholder={t("priceMax")}
                aria-label={t("priceMax")}
                value={draft.priceMax}
                onChange={(event) => setDraft((d) => ({ ...d, priceMax: event.target.value }))}
              />
            </div>
          </FormField>
        </div>
      </Drawer>
    </>
  );
}

export function ProductFilterChips({ value, onChange }: ProductFilterChipsProps) {
  const t = useTranslations("products.filters");
  const formatMoney = useMoneyFormatter();
  const categories = useCategoryOptions();

  if (countProductFilters(value) === 0) {
    return null;
  }

  const chips: { key: string; label: string; clear: ProductFiltersValue }[] = [];
  if (value.categoryId) {
    const name = categories.find((category) => category.value === value.categoryId)?.name ?? "";
    chips.push({ key: "category", label: t("chipCategory", { name }), clear: { ...value, categoryId: null } });
  }
  if (value.status) {
    const name = value.status === "active" ? t("statusActive") : t("statusHidden");
    chips.push({ key: "status", label: t("chipStatus", { name }), clear: { ...value, status: null } });
  }
  if (value.stock) {
    const name = value.stock === "in_stock" ? t("stockInStock") : t("stockOutOfStock");
    chips.push({ key: "stock", label: t("chipStock", { name }), clear: { ...value, stock: null } });
  }
  if (value.priceMin || value.priceMax) {
    const label =
      value.priceMin && value.priceMax
        ? t("chipPrice", { min: formatMoney(value.priceMin), max: formatMoney(value.priceMax) })
        : value.priceMin
          ? t("chipPriceMin", { min: formatMoney(value.priceMin) })
          : t("chipPriceMax", { max: formatMoney(value.priceMax) });
    chips.push({ key: "price", label, clear: { ...value, priceMin: "", priceMax: "" } });
  }

  return (
    <ChipGroup data-testid="product-filter-chips">
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          data-testid={`product-filter-chip-${chip.key}`}
          onRemove={() => onChange(chip.clear)}
          removeLabel={t("removeFilter", { name: chip.label })}
        >
          {chip.label}
        </Chip>
      ))}
    </ChipGroup>
  );
}
