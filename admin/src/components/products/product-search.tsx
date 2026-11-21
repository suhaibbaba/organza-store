"use client";

import { useTranslations } from "next-intl";
import { SearchField } from "@store/ui";

interface ProductSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function ProductSearch({ value, onChange }: ProductSearchProps) {
  const t = useTranslations("products");

  return (
    <SearchField
      data-testid="products-search"
      label={t("search.label")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t("search.placeholder")}
      onClear={() => onChange("")}
      clearLabel={t("search.clear")}
    />
  );
}
