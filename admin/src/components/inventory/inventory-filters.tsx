"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCategoriesQuery } from "@/hooks/use-categories";
import { flattenCategoryTree } from "@/lib/api/categories";
import { localize } from "@/lib/i18n-content";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
        value={categoryId ?? ""}
        onChange={(e) => onCategoryChange(e.target.value || null)}
      >
        <option value="">{t("allCategories")}</option>
        {categoryOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {"  ".repeat(c.depth)}
            {localize(c.name, locale)}
          </option>
        ))}
      </Select>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
        <div className="min-w-0">
          <Label htmlFor="low-stock-toggle">{t("lowStockOnly")}</Label>
          {lowStock && lowStockCount !== null && (
            <p className="mt-0.5 text-xs text-muted-foreground">{t("lowStockCount", { count: lowStockCount })}</p>
          )}
        </div>
        <Switch id="low-stock-toggle" checked={lowStock} onCheckedChange={onLowStockChange} />
      </div>
    </div>
  );
}
