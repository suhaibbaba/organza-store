"use client";

import { useLocale, useTranslations } from "next-intl";
import { PRODUCT_PRINT_STATES } from "@store/shared/constants/product";
import type { ProductPrintState } from "@store/shared/types/product";
import { useCategoriesQuery } from "@/hooks/use-categories";
import { flattenCategoryTree } from "@/lib/api/categories";
import { localize } from "@/lib/i18n-content";
import { SegmentedControl, Select } from "@store/ui";

interface LabelFiltersProps {
  printState: ProductPrintState;
  categoryId: string | null;
  onPrintStateChange: (printState: ProductPrintState) => void;
  onCategoryChange: (categoryId: string | null) => void;
}

// Toggles, not a dropdown: which labels are still owed is this screen's question, so it stays one tap away.
export function LabelFilters({ printState, categoryId, onPrintStateChange, onCategoryChange }: LabelFiltersProps) {
  const t = useTranslations("labels.filters");
  const locale = useLocale();
  const { data: categoryTree } = useCategoriesQuery();
  const categoryOptions = categoryTree ? flattenCategoryTree(categoryTree) : [];

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        data-testid="segmented"
        label={t("printState")}
        value={printState}
        onChange={onPrintStateChange}
        options={PRODUCT_PRINT_STATES.map((state) => ({ value: state, label: t(state) }))}
      />

      <Select
        aria-label={t("category")}
        placeholder={t("allCategories")}
        value={categoryId ?? ""}
        onChange={(e) => onCategoryChange(e.target.value || null)}
        options={categoryOptions.map((category) => ({
          value: category.id,
          label: `${"\u00A0\u00A0".repeat(category.depth)}${localize(category.name, locale)}`,
        }))}
      />
    </div>
  );
}
