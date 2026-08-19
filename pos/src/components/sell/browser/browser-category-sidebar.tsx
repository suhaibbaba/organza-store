"use client";

import { useLocale, useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { localize } from "@/lib/i18n-content";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import type { SidebarCategories, SidebarCategory } from "@/types/category";
import { testSelectorFor } from "@organza/shared/lib/testSelector";

interface BrowserCategorySidebarProps {
  categories: SidebarCategories;
  // null = "All", the drawer's resting state.
  selectedId: string | null;
  onSelect: (categoryId: string | null) => void;
  isLoading: boolean;
  isError: boolean;
}

// The shelves, down the start side of the product browser — right in Arabic,
// left in English, with nothing mirrored by hand: the column is placed by the
// drawer's flex order and every inset below is logical.
//
// Categories, never products. It is the column a cashier's thumb rests on
// while the other hand holds the garment, so it stays put while the grid
// beside it changes, and it is ordered by what actually gets sold rather than
// by the shape of the tree: "All" first, then the shelves the shop pinned in
// the admin, then the whole tree indented under its parents. A pinned shelf
// still appears down in the tree as well — lifting it to the top must not
// take it away from somebody who knows where it lives.
export function BrowserCategorySidebar({
  categories,
  selectedId,
  onSelect,
  isLoading,
  isError,
}: BrowserCategorySidebarProps) {
  const t = useTranslations("sell.browse");

  return (
    <nav
      aria-label={t("categories")}
      data-test-selector="pos-browse-categories"
      // A narrow rail on a phone and a proper column from `sm`. Its own
      // scroll, so a long category list never scrolls the grid away with it.
      className="w-28 shrink-0 overflow-y-auto border-e border-border bg-secondary/30 py-2 sm:w-48 lg:w-56"
    >
      <ul className="flex flex-col gap-0.5 px-1.5">
        <li>
          <CategoryRow
            categoryId={null}
            label={t("all")}
            depth={0}
            isSelected={selectedId === null}
            onSelect={() => onSelect(null)}
          />
        </li>
      </ul>

      {isLoading && (
        <p className="flex items-center justify-center py-6 text-muted-foreground">
          <Spinner />
          <span className="sr-only">{t("categoriesLoading")}</span>
        </p>
      )}

      {/* Not an alert over the whole drawer: the grid is still perfectly
          usable with "All" selected, so a sidebar that failed to load says so
          quietly in its own column and leaves the cashier selling. */}
      {isError && <p className="px-3 py-4 text-xs text-muted-foreground">{t("categoriesError")}</p>}

      {categories.favorites.length > 0 && (
        <CategoryGroup
          title={t("favorites")}
          rows={categories.favorites}
          selectedId={selectedId}
          onSelect={onSelect}
          showStar
        />
      )}

      {categories.all.length > 0 && (
        <CategoryGroup title={t("allCategories")} rows={categories.all} selectedId={selectedId} onSelect={onSelect} />
      )}
    </nav>
  );
}

interface CategoryGroupProps {
  title: string;
  rows: SidebarCategory[];
  selectedId: string | null;
  onSelect: (categoryId: string | null) => void;
  showStar?: boolean;
}

function CategoryGroup({ title, rows, selectedId, onSelect, showStar = false }: CategoryGroupProps) {
  const locale = useLocale();

  return (
    <>
      <h3 className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="flex flex-col gap-0.5 px-1.5">
        {rows.map((row) => (
          <li key={row.id}>
            <CategoryRow
              categoryId={row.id}
              label={localize(row.name, locale)}
              depth={row.depth}
              isSelected={selectedId === row.id}
              onSelect={() => onSelect(row.id)}
              showStar={showStar}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

interface CategoryRowProps {
  // The category this row filters to, or null for "everything" — the row's
  // name in the DOM comes from this and never from the label, which is
  // translated and would read differently in each language.
  categoryId: string | null;
  label: string;
  depth: number;
  isSelected: boolean;
  onSelect: () => void;
  showStar?: boolean;
}

// One shelf. Thumb-height whatever the label does, and the label wraps to two
// lines rather than being cut off — an Arabic category name is longer than the
// English these rails are usually drawn for, and a cashier picking by eye
// needs to read the whole word.
function CategoryRow({ categoryId, label, depth, isSelected, onSelect, showStar = false }: CategoryRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      // Not aria-pressed: this is a filter with one answer at a time, so the
      // selected row is the current one rather than a switch that is on.
      aria-current={isSelected ? "true" : undefined}
      data-test-selector={testSelectorFor("pos-browse-category", categoryId ?? "all")}
      // Indentation is a logical inset, so a child sits under its parent in
      // Arabic and English alike. It is added to the row's own padding rather
      // than replacing it.
      style={{ paddingInlineStart: `${0.75 + depth * 0.625}rem` }}
      className={cn(
        "flex min-h-11 w-full items-center gap-1.5 rounded-lg pe-2 py-1.5 text-start text-xs",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
        isSelected
          ? "bg-primary text-primary-foreground font-semibold"
          : "text-foreground hover:bg-accent/60 active:bg-accent/60"
      )}
    >
      {showStar && (
        <Star
          className={cn("size-3.5 shrink-0", isSelected ? "text-primary-foreground" : "text-warning")}
          aria-hidden="true"
        />
      )}
      <span className="line-clamp-2 min-w-0">{label}</span>
    </button>
  );
}
