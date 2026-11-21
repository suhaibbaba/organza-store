"use client";

import { useLocale, useTranslations } from "next-intl";
import { Select, Switch } from "@store/ui";
import { fieldTestSelector } from "@organza/shared/lib/testSelector";
import { useCategoriesQuery } from "@/hooks/use-categories";
import { flattenCategoryTree } from "@/lib/api/categories";
import { localize } from "@/lib/i18n-content";

interface InventoryFiltersProps {
  categoryId: string | null;
  lowStock: boolean;
  lowStockCount: number | null;
  onCategoryChange: (categoryId: string | null) => void;
  onLowStockChange: (lowStock: boolean) => void;
}

export function InventoryFilters({
  categoryId,
  lowStock,
  lowStockCount,
  onCategoryChange,
  onLowStockChange,
}: InventoryFiltersProps) {
  const t = useTranslations("inventory.filters");
  const locale = useLocale();
  const { data: categoryTree } = useCategoriesQuery();
  const categoryOptions = categoryTree ? flattenCategoryTree(categoryTree) : [];

  return (
    <div className="flex flex-col gap-3">
      <Select
        aria-label={t("category")}
        placeholder={t("allCategories")}
        options={categoryOptions.map((c) => ({
          value: c.id,
          label: `${"\u00a0\u00a0".repeat(c.depth)}${localize(c.name, locale)}`,
        }))}
        value={categoryId ?? ""}
        onChange={(e) => onCategoryChange(e.target.value || null)}
      />

      <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-3">
        <div className="min-w-0">
          <Switch
            id="low-stock-toggle"
            data-testid={fieldTestSelector("low-stock-toggle")}
            label={t("lowStockOnly")}
            checked={lowStock}
            onCheckedChange={onLowStockChange}
          />
          {lowStock && lowStockCount !== null && (
            <p className="mt-0.5 text-meta text-ink-muted">{t("lowStockCount", { count: lowStockCount })}</p>
          )}
        </div>
      </div>
    </div>
  );
}
