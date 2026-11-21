"use client";

import { useTranslations } from "next-intl";
import { Select } from "@store/ui";
import { PRODUCT_SORT_OPTIONS } from "@/constants/products";
import type { ProductListFilters } from "@/types/product";

interface ProductSortSelectProps {
  sortBy: ProductListFilters["sortBy"];
  sortDir: ProductListFilters["sortDir"];
  onChange: (sortBy: ProductListFilters["sortBy"], sortDir: ProductListFilters["sortDir"]) => void;
}

export function ProductSortSelect({ sortBy, sortDir, onChange }: ProductSortSelectProps) {
  const t = useTranslations("products.sort");
  const value = `${sortBy}-${sortDir}`;

  return (
    <Select
      data-testid="products-sort"
      aria-label={t("label")}
      value={value}
      options={PRODUCT_SORT_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
      onChange={(e) => {
        const option = PRODUCT_SORT_OPTIONS.find((o) => o.value === e.target.value);
        if (option) onChange(option.sortBy, option.sortDir);
      }}
    />
  );
}
