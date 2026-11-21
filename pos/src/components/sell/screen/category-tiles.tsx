"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { useCategoriesQuery } from "@/hooks/use-categories";
import { useProductCount } from "@/hooks/use-product-count";
import { localize } from "@/lib/i18n-content";
import { cn } from "@/lib/utils";
import { Spinner } from "@store/ui";
import { SectionTitle } from "@/components/sell/screen/section-title";

interface CategoryTilesProps {
  // null = "All".
  selectedId: string | null;
  onSelect: (categoryId: string | null) => void;
}

interface Tile {
  id: string | null;
  label: string;
  count: number | null;
}

const TITLE_ID = "pos-categories-title";

// "All", then the shelves pinned in the admin (Category.isFavorite), then the rest; counts roll up through subcategories.
export function CategoryTiles({ selectedId, onSelect }: CategoryTilesProps) {
  const t = useTranslations("sell");
  const locale = useLocale();
  const categories = useCategoriesQuery();
  const productCount = useProductCount();

  const tiles = useMemo<Tile[]>(() => {
    const list = categories.data ?? [];
    const pinned = list.filter((category) => category.isFavorite);
    const rest = list.filter((category) => !category.isFavorite);
    return [
      { id: null, label: t("browse.all"), count: productCount.data ?? null },
      ...[...pinned, ...rest].map((category) => ({
        id: category.id,
        label: localize(category.name, locale),
        count: category.productCount,
      })),
    ];
  }, [categories.data, locale, productCount.data, t]);

  return (
    <section aria-labelledby={TITLE_ID} className="flex flex-col gap-3">
      <SectionTitle id={TITLE_ID}>{t("screen.categoriesTitle")}</SectionTitle>

      {categories.isError ? (
        <p className="text-label text-ink-muted">{t("browse.categoriesError")}</p>
      ) : (
        // The last tile is cut by the screen's edge, which is what says there is more.
        <ul
          className="scrollbar-none flex gap-2 overflow-x-auto"
          data-test-selector="pos-category-tiles"
        >
          {tiles.map((tile) => {
            const selected = tile.id === selectedId;
            return (
              <li key={tile.id ?? "all"} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onSelect(tile.id)}
                  aria-pressed={selected}
                  data-test-selector={testSelectorFor("pos-category-tile", tile.id ?? "all")}
                  className={cn(
                    "flex min-h-11 min-w-24 cursor-pointer flex-col items-start rounded-tile border px-3.5 py-1.5 text-start transition-[background-color,border-color,box-shadow] tab:min-w-27",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                    selected
                      ? "border-selected-line bg-selected text-primary-700"
                      : "border-line bg-surface text-ink shadow-pill hover:border-line-strong hover:bg-row-hover"
                  )}
                >
                  <span className="max-w-40 truncate text-label font-semibold">{tile.label}</span>
                  <span className="min-h-5 text-micro text-ink-muted tabular-nums">
                    {tile.count !== null && t("screen.productCount", { count: tile.count })}
                  </span>
                </button>
              </li>
            );
          })}
          {categories.isPending && (
            <li className="flex shrink-0 items-center px-3">
              <Spinner label={t("browse.categoriesLoading")} />
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
