"use client";

import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Star } from "lucide-react";
import type { CategoryNode } from "@store/shared/types/category";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { Badge, IconButton, Spinner, Typography } from "@store/ui";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/i18n-content";
import { cn } from "@/lib/utils";
import type { CategoryTreeListProps } from "@/types/category";

const INDENT_REM = 2.25;
const ROW_OWN_CONTROLS = "a, button, [role='menu'], [role='menuitem']";

export function CategoryTreeList({
  rows,
  canManage,
  isSearching,
  collapsedIds,
  favoritePendingId,
  onToggleExpanded,
  onToggleFavorite,
  renderMenu,
}: CategoryTreeListProps) {
  const t = useTranslations("categories.tree");
  const locale = useLocale();

  function renderRow(node: CategoryNode, depth: number) {
    const name = localize(node.name, locale);
    const hasChildren = node.children.length > 0;
    const expanded = isSearching || !collapsedIds.has(node.id);
    const isTogglingFavorite = favoritePendingId === node.id;
    const rowToggles = hasChildren && !isSearching;

    return (
      <li
        key={node.id}
        data-test-selector={testSelectorFor("category-row", node.id)}
        className={cn(
          "flex min-h-16 items-center gap-2 py-2.5 pe-3 transition-colors",
          depth > 0 && "bg-sunken/40",
          rowToggles && "cursor-pointer hover:bg-primary-50",
        )}
        onClick={(event) => {
          // The whole row folds for a mouse; the chevron stays the keyboard control, and links/buttons/menus keep their own action.
          if (rowToggles && !(event.target as Element).closest(ROW_OWN_CONTROLS)) {
            onToggleExpanded(node);
          }
        }}
        style={{ paddingInlineStart: `${0.75 + depth * INDENT_REM}rem` }}
      >
        {rowToggles ? (
          <IconButton
            data-testid={testSelectorFor("category-toggle", node.id)}
            label={expanded ? t("collapse", { name }) : t("expand", { name })}
            aria-expanded={expanded}
            icon={
              expanded ? (
                <ChevronDown aria-hidden="true" />
              ) : (
                <ChevronRight className="rtl:rotate-180" aria-hidden="true" />
              )
            }
            onClick={() => onToggleExpanded(node)}
          />
        ) : (
          <span className="size-6 shrink-0" aria-hidden="true" />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Typography variant="body" weight="medium" as="span" className="break-words">
              {name}
            </Typography>
            {node.isFavorite && (
              <Badge tone="warning" data-testid={testSelectorFor("category-pinned", node.id)}>
                {t("pinned")}
              </Badge>
            )}
          </div>
          <Typography variant="small" tone="muted" as="span" className="flex flex-wrap gap-x-1.5">
            {/* The count is active products only (the POS tile figure), so the link asks for those alone. */}
            {node.productCount > 0 ? (
              <Link
                href={{ pathname: "/products", query: { categoryId: node.id, status: "active" } }}
                aria-label={`${t("productsLink", { name })} (${t("products", { count: node.productCount })})`}
                data-test-selector={testSelectorFor("category-products", node.id)}
                className="rounded-control transition-colors hover:text-primary-700 focus-link"
              >
                {t("products", { count: node.productCount })}
              </Link>
            ) : (
              <span>{t("products", { count: 0 })}</span>
            )}
            {hasChildren && (
              <>
                <span aria-hidden="true">·</span>
                <span>{t("subcategories", { count: node.children.length })}</span>
              </>
            )}
          </Typography>
        </div>

        {canManage && (
          <div className="flex shrink-0 items-center gap-3">
            <IconButton
              data-testid={testSelectorFor("category-favorite", node.id)}
              label={node.isFavorite ? t("unpin", { name }) : t("pin", { name })}
              aria-pressed={node.isFavorite}
              disabled={isTogglingFavorite}
              className={cn(node.isFavorite && "text-warning-700 hover:text-warning-800")}
              icon={
                isTogglingFavorite ? (
                  <Spinner className="size-4" />
                ) : (
                  <Star className={cn(node.isFavorite && "fill-current")} aria-hidden="true" />
                )
              }
              onClick={() => onToggleFavorite(node)}
            />
            {renderMenu(node)}
          </div>
        )}
      </li>
    );
  }

  return (
    <ul
      aria-label={t("label")}
      data-test-selector="category-tree"
      className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card"
    >
      {rows.map(({ node, depth }) => renderRow(node, depth))}
    </ul>
  );
}
