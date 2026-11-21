"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { Button, Chip, ChipGroup, Drawer, FormField, Select, Typography } from "@store/ui";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { useCategoriesQuery } from "@/hooks/use-categories";
import { flattenCategoryTree } from "@/lib/api/categories";
import { localize } from "@/lib/i18n-content";
import type {
  LabelCategoryFilterProps,
  LabelFilterChipsProps,
  LabelFiltersProps,
  LabelFiltersValue,
} from "@/types/label";

export const EMPTY_LABEL_FILTERS: LabelFiltersValue = { categoryId: null };

export function countLabelFilters(value: LabelFiltersValue): number {
  return value.categoryId ? 1 : 0;
}

function useCategoryOptions() {
  const locale = useLocale();
  const { data: tree } = useCategoriesQuery();
  return (tree ? flattenCategoryTree(tree) : []).map((category) => ({
    value: category.id,
    label: `${"  ".repeat(category.depth)}${localize(category.name, locale)}`,
    name: localize(category.name, locale),
  }));
}

// Desktop keeps the category in the toolbar, applied at once; phones reach it through the drawer.
export function LabelCategoryFilter({ value, onChange }: LabelCategoryFilterProps) {
  const t = useTranslations("labels.filters");
  const categories = useCategoryOptions();
  return (
    <div className="hidden w-60 shrink-0 md:block">
      <Select
        aria-label={t("category")}
        data-testid="labels-category"
        value={value ?? ""}
        placeholder={t("allCategories")}
        options={categories.map(({ value: id, label }) => ({ value: id, label }))}
        onChange={(event) => onChange(event.target.value || null)}
      />
    </div>
  );
}

export function LabelFilters({ value, onApply }: LabelFiltersProps) {
  const t = useTranslations("labels.filters");
  const categories = useCategoryOptions();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const activeCount = countLabelFilters(value);

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(value);
    }
    setOpen(next);
  }

  function apply(next: LabelFiltersValue) {
    onApply(next);
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => handleOpenChange(true)}
        data-test-selector="label-filters-open"
        className="relative shrink-0 md:hidden"
        icon={<SlidersHorizontal className="size-4" aria-hidden="true" />}
      >
        {t("trigger")}
        {activeCount > 0 && (
          <Typography
            variant="caption"
            as="span"
            className="absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center rounded-pill bg-primary-600 text-ink-inverse"
          >
            {activeCount}
          </Typography>
        )}
      </Button>

      <Drawer
        data-testid="sheet-label-filters"
        open={open}
        onOpenChange={handleOpenChange}
        title={t("title")}
        descriptionKey="labels.filters.title"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => apply(EMPTY_LABEL_FILTERS)}
              data-test-selector="label-filters-reset"
            >
              {t("reset")}
            </Button>
            <Button onClick={() => apply(draft)} data-test-selector="label-filters-apply">
              {t("apply")}
            </Button>
          </>
        }
      >
        <FormField label="labels.filters.category" hint="labels.filters.categoryHint" htmlFor="label-filter-category">
          <Select
            id="label-filter-category"
            data-testid={fieldTestSelector("filter-category")}
            value={draft.categoryId ?? ""}
            placeholder={t("allCategories")}
            options={categories.map(({ value: id, label }) => ({ value: id, label }))}
            onChange={(event) => setDraft({ categoryId: event.target.value || null })}
          />
        </FormField>
      </Drawer>
    </>
  );
}

export function LabelFilterChips({ value, onChange }: LabelFilterChipsProps) {
  const t = useTranslations("labels.filters");
  const categories = useCategoryOptions();

  if (!value.categoryId) {
    return null;
  }
  const name = categories.find((category) => category.value === value.categoryId)?.name ?? "";
  const label = t("chipCategory", { name });

  return (
    <ChipGroup data-testid="label-filter-chips">
      <Chip
        data-testid="label-filter-chip-category"
        onRemove={() => onChange(EMPTY_LABEL_FILTERS)}
        removeLabel={t("removeFilter", { name: label })}
      >
        {label}
      </Chip>
    </ChipGroup>
  );
}
