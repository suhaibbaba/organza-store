"use client";

import { useLocale, useTranslations } from "next-intl";
import { PRODUCT_PRINT_STATES } from "@shared/constants/product";
import type { ProductPrintState } from "@shared/types/product";
import { useCategoriesQuery } from "@/hooks/use-categories";
import { flattenCategoryTree } from "@/lib/api/categories";
import { localize } from "@/lib/i18n-content";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
      <div
        role="group"
        aria-label={t("printState")}
        className="inline-flex w-fit gap-1 rounded-xl border border-border bg-card p-1"
      >
        {PRODUCT_PRINT_STATES.map((state) => (
          <button
            key={state}
            type="button"
            onClick={() => onPrintStateChange(state)}
            aria-pressed={printState === state}
            className={cn(
              // The row is sized to its content, so each chip takes the width
              // of its own label — flex-1 would give all three the same width
              // and clip the longest ("غير مطبوعة"), which whitespace-nowrap
              // then has nowhere to put. min-w keeps the shortest a full
              // 44px target all the same.
              "min-h-11 min-w-16 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              printState === state
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {t(state)}
          </button>
        ))}
      </div>

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
