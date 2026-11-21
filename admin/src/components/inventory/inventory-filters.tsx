"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { Button, Chip, ChipGroup, Drawer, FormField, Select, Switch } from "@store/ui";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { useCategoriesQuery } from "@/hooks/use-categories";
import { flattenCategoryTree } from "@/lib/api/categories";
import { localize } from "@/lib/i18n-content";

export interface InventoryFiltersValue {
  categoryId: string | null;
  lowStock: boolean;
}

interface InventoryFiltersProps {
  value: InventoryFiltersValue;
  onApply: (value: InventoryFiltersValue) => void;
}

const EMPTY: InventoryFiltersValue = { categoryId: null, lowStock: false };

export function InventoryFilters({ value, onApply }: InventoryFiltersProps) {
  const t = useTranslations("inventory.filters");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const { data: categoryTree } = useCategoriesQuery();
  const categoryOptions = categoryTree ? flattenCategoryTree(categoryTree) : [];
  const activeCount = (value.categoryId ? 1 : 0) + (value.lowStock ? 1 : 0);

  function handleOpenChange(next: boolean) {
    if (next) setDraft(value);
    setOpen(next);
  }

  function apply(next: InventoryFiltersValue) {
    onApply(next);
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => handleOpenChange(true)}
        data-test-selector="inventory-filters-open"
        className="relative shrink-0"
        icon={<SlidersHorizontal className="size-4" aria-hidden="true" />}
      >
        {t("trigger")}
        {activeCount > 0 && (
          <span className="absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center rounded-pill bg-primary-600 text-micro text-ink-inverse">
            {activeCount}
          </span>
        )}
      </Button>

      <Drawer
        data-testid="sheet-inventory-filters"
        open={open}
        onOpenChange={handleOpenChange}
        title={t("title")}
        descriptionKey="inventory.filters.title"
        footer={
          <>
            <Button variant="secondary" onClick={() => apply(EMPTY)} data-test-selector="inventory-filters-reset">
              {t("reset")}
            </Button>
            <Button onClick={() => apply(draft)} data-test-selector="inventory-filters-apply">
              {t("apply")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <FormField label="inventory.filters.category" htmlFor="inventory-filter-category">
            <Select
              id="inventory-filter-category"
              data-testid={fieldTestSelector("inventory-filter-category")}
              placeholder={t("allCategories")}
              options={categoryOptions.map((c) => ({
                value: c.id,
                label: `${"  ".repeat(c.depth)}${localize(c.name, locale)}`,
              }))}
              value={draft.categoryId ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value || null }))}
            />
          </FormField>

          <FormField label="inventory.filters.lowStockOnly" hint="inventory.filters.lowStockHint" htmlFor="low-stock-toggle">
            <Switch
              id="low-stock-toggle"
              data-testid={fieldTestSelector("low-stock-toggle")}
              label={t("lowStockOnly")}
              hideLabel
              checked={draft.lowStock}
              onCheckedChange={(lowStock) => setDraft((d) => ({ ...d, lowStock }))}
            />
          </FormField>
        </div>
      </Drawer>
    </>
  );
}

interface InventoryFilterChipsProps {
  value: InventoryFiltersValue;
  onChange: (value: InventoryFiltersValue) => void;
}

export function InventoryFilterChips({ value, onChange }: InventoryFilterChipsProps) {
  const t = useTranslations("inventory.filters");
  const locale = useLocale();
  const { data: categoryTree } = useCategoriesQuery();
  const category = value.categoryId
    ? (categoryTree ? flattenCategoryTree(categoryTree) : []).find((c) => c.id === value.categoryId)
    : undefined;

  if (!value.categoryId && !value.lowStock) return null;

  const chips: { key: string; label: string; clear: InventoryFiltersValue }[] = [];
  if (value.categoryId) {
    chips.push({
      key: "category",
      label: t("chipCategory", { name: category ? localize(category.name, locale) : "" }),
      clear: { ...value, categoryId: null },
    });
  }
  if (value.lowStock) {
    chips.push({
      key: "low-stock",
      label: t("chipLowStock"),
      clear: { ...value, lowStock: false },
    });
  }

  return (
    <ChipGroup data-testid="inventory-filter-chips">
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          data-testid={`inventory-filter-chip-${chip.key}`}
          onRemove={() => onChange(chip.clear)}
          removeLabel={t("removeFilter", { name: chip.label })}
        >
          {chip.label}
        </Chip>
      ))}
    </ChipGroup>
  );
}
