"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronsUpDown, Plus } from "lucide-react";
import type { CategoryNode } from "@store/shared/types/category";
import { can } from "@store/shared/lib/permissions";
import { Button, SearchField, TotalBadge, Typography, useToast } from "@store/ui";
import { useSession } from "@/components/providers/session-provider";
import { useCategoriesQuery, useToggleCategoryFavoriteMutation } from "@/hooks/use-categories";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useUrlSearch } from "@/hooks/use-url-search";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryTreeList } from "@/components/categories/category-tree-list";
import { CategoryFormModal } from "@/components/categories/category-form-modal";
import { useCategoryRowMenu } from "@/components/categories/category-row-menu";
import {
  CategoryListEmpty,
  CategoryListError,
  CategoryListLoading,
  CategoryListNoMatch,
} from "@/components/categories/category-list-states";
import { categoryIdsWithChildren, countCategories, filterCategoryTree, visibleCategoryRows } from "@/lib/categories";
import {
  CATEGORY_LIST_URL_PARAMS,
  CATEGORY_SEARCH_DEBOUNCE_MS,
  DEFAULT_CATEGORY_FILTERS,
} from "@/constants/categories";
import type { CategoryFormTarget } from "@/types/category";
import { errorMessageKey } from "@/lib/error-message-key";

const NO_COLLAPSED: ReadonlySet<string> = new Set();

export default function CategoriesPage() {
  const t = useTranslations("categories");
  const toast = useToast();
  const { user } = useSession();
  const canManage = can(user, "category.manage");

  const { data: tree, isLoading, isError, error, refetch } = useCategoriesQuery();
  const favoriteMutation = useToggleCategoryFavoriteMutation();

  const [filters, changeFilters] = useUrlFilters(DEFAULT_CATEGORY_FILTERS, CATEGORY_LIST_URL_PARAMS);
  const [searchInput, setSearchInput] = useUrlSearch(
    filters.q,
    (q) => changeFilters({ q }),
    CATEGORY_SEARCH_DEBOUNCE_MS,
  );
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(NO_COLLAPSED);
  const [formTarget, setFormTarget] = useState<CategoryFormTarget | null>(null);
  const { renderMenu, dialog } = useCategoryRowMenu(setFormTarget);

  const isSearching = searchInput.trim().length > 0;
  const allNodes = useMemo(() => tree ?? [], [tree]);
  const shown = useMemo(() => filterCategoryTree(allNodes, searchInput), [allNodes, searchInput]);
  const rows = useMemo(
    () => visibleCategoryRows(shown, isSearching ? NO_COLLAPSED : collapsedIds),
    [shown, isSearching, collapsedIds],
  );
  const parentIds = useMemo(() => categoryIdsWithChildren(allNodes), [allNodes]);
  const anyExpanded = parentIds.some((id) => !collapsedIds.has(id));

  function toggleExpanded(node: CategoryNode) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (!next.delete(node.id)) {
        next.add(node.id);
      }
      return next;
    });
  }

  async function toggleFavorite(node: CategoryNode) {
    try {
      await favoriteMutation.mutateAsync({ id: node.id, isFavorite: !node.isFavorite });
      toast.success(node.isFavorite ? "categories.favorite.unpinned" : "categories.favorite.pinned");
    } catch (err) {
      toast.error(errorMessageKey(err));
    }
  }

  const favoritePendingId = favoriteMutation.isPending ? (favoriteMutation.variables?.id ?? null) : null;

  function renderBody() {
    if (isLoading) {
      return <CategoryListLoading />;
    }
    if (isError) {
      return <CategoryListError error={error} onRetry={() => void refetch()} />;
    }
    if (allNodes.length === 0) {
      return <CategoryListEmpty />;
    }
    if (rows.length === 0) {
      return <CategoryListNoMatch />;
    }
    return (
      <CategoryTreeList
        rows={rows}
        canManage={canManage}
        isSearching={isSearching}
        collapsedIds={collapsedIds}
        favoritePendingId={favoritePendingId}
        onToggleExpanded={toggleExpanded}
        onToggleFavorite={(node) => void toggleFavorite(node)}
        renderMenu={renderMenu}
      />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        name="categories"
        title={t("title")}
        description={t("subtitle")}
        actions={
          canManage && (
            <Button
              className="shrink-0"
              onClick={() => setFormTarget({ mode: "create", parentId: null })}
              data-test-selector="add-category"
              icon={<Plus className="size-4" aria-hidden="true" />}
            >
              {t("addCategory")}
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-64 flex-1 sm:max-w-md">
            <SearchField
              data-testid="categories-search"
              label={t("search.label")}
              placeholder={t("search.placeholder")}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onClear={() => setSearchInput("")}
              clearLabel={t("search.clear")}
            />
          </div>
          {!isSearching && parentIds.length > 0 && (
            <Button
              variant="secondary"
              data-test-selector="categories-toggle-all"
              icon={<ChevronsUpDown className="size-4" aria-hidden="true" />}
              onClick={() => setCollapsedIds(anyExpanded ? new Set(parentIds) : NO_COLLAPSED)}
            >
              {anyExpanded ? t("collapseAll") : t("expandAll")}
            </Button>
          )}
          {tree && (
            <div className="ms-auto flex h-(--control-h) items-center">
              <TotalBadge data-testid="categories-count" label="categories.total" total={countCategories(shown)} />
            </div>
          )}
        </div>

        <Typography variant="small" tone="muted" as="p">
          {canManage ? t("favoritesHint") : t("readOnlyHint")}
        </Typography>

        {renderBody()}
      </div>

      {canManage && <CategoryFormModal target={formTarget} tree={allNodes} onClose={() => setFormTarget(null)} />}
      {dialog}
    </PageContainer>
  );
}
