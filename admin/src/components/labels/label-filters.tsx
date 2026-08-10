"use client";

import { useLocale, useTranslations } from "next-intl";
import { PRODUCT_PRINT_STATES } from "@shared/constants/product";
import type { ProductPrintState } from "@shared/types/product";
import { useCategoriesQuery } from "@/hooks/use-categories";
import { flattenCategoryTree } from "@/lib/api/categories";
import { localize } from "@/lib/i18n-content";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";

interface LabelFiltersProps {
  printState: ProductPrintState;
  categoryId: string | null;
  onPrintStateChange: (printState: ProductPrintState) => void;
  onCategoryChange: (categoryId: string | null) => void;
}

// Three toggles rather than a dropdown: which labels are still owed is the
// question this screen exists to answer, so it stays one tap away and always
// visible.
export function LabelFilters({
  printState,
  categoryId,
  onPrintStateChange,
  onCategoryChange,
}: LabelFiltersProps) {
  const t = useTranslations("labels.filters");
  const locale = useLocale();
  const { data: categoryTree } = useCategoriesQuery();
  const categoryOptions = categoryTree ? flattenCategoryTree(categoryTree) : [];

  return (
    <div className="flex flex-col gap-3">
      {/* The row sizes each chip to its own label and scrolls rather than
          wrapping — the shared control's doing, so "غير مطبوعة" can't end up
          on two lines here again. */}
      <SegmentedControl
        label={t("printState")}
        value={printState}
        onChange={onPrintStateChange}
        options={PRODUCT_PRINT_STATES.map((state) => ({ value: state, label: t(state) }))}
      />

      <Select
        aria-label={t("category")}
        value={categoryId ?? ""}
        onChange={(e) => onCategoryChange(e.target.value || null)}
      >
        <option value="">{t("allCategories")}</option>
        {categoryOptions.map((category) => (
          <option key={category.id} value={category.id}>
            {"  ".repeat(category.depth)}
            {localize(category.name, locale)}
          </option>
        ))}
      </Select>
    </div>
  );
}
