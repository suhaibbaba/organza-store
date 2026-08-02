"use client";

import { useTranslations } from "next-intl";
import { PRODUCT_SORT_OPTIONS } from "@/constants/products";
import { Select } from "@/components/ui/select";
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
      aria-label={t("label")}
      value={value}
      onChange={(e) => {
        const option = PRODUCT_SORT_OPTIONS.find((o) => o.value === e.target.value);
        if (option) onChange(option.sortBy, option.sortDir);
      }}
    >
      {PRODUCT_SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {t(option.labelKey)}
        </option>
      ))}
    </Select>
  );
}
