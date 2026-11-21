"use client";

import { useTranslations } from "next-intl";
import { SearchField } from "@store/ui";

interface InventorySearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function InventorySearch({ value, onChange }: InventorySearchProps) {
  const t = useTranslations("inventory");

  return (
    <SearchField
      label={t("search.label")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClear={() => onChange("")}
      clearLabel={t("search.clear")}
      placeholder={t("search.placeholder")}
      data-testid="inventory-search"
    />
  );
}
