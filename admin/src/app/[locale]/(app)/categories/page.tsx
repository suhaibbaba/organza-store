"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import type { CategoryNode } from "@store/shared/types/category";
import { can } from "@store/shared/lib/permissions";
import { useSession } from "@/components/providers/session-provider";
import {
  useCategoriesQuery,
  useDeleteCategoryMutation,
  useToggleCategoryFavoriteMutation,
} from "@/hooks/use-categories";
import { useTranslateError } from "@/hooks/use-translate-error";
import { Alert, Button } from "@store/ui";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryTree } from "@/components/categories/category-tree";
import { CategoryFormSheet } from "@/components/categories/category-form-sheet";
import { CategoryListEmpty, CategoryListError, CategoryListLoading } from "@/components/categories/category-list-states";
import { ApiError } from "@/lib/api/errors";

export default function CategoriesPage() {
  const t = useTranslations("categories");
  const translateError = useTranslateError();
  const { user } = useSession();
  const canManage = can(user, "category.manage");

  const { data: tree, isLoading, isError, error, refetch } = useCategoriesQuery();
  const deleteMutation = useDeleteCategoryMutation();
  const favoriteMutation = useToggleCategoryFavoriteMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingCategory, setEditingCategory] = useState<CategoryNode | undefined>(undefined);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function openCreateForm() {
    setFormMode("create");
    setEditingCategory(undefined);
    setFormOpen(true);
  }

  function openEditForm(node: CategoryNode) {
    setFormMode("edit");
    setEditingCategory(node);
    setFormOpen(true);
  }

  function requestDelete(id: string) {
    setActionError(null);
    setConfirmDeleteId(id);
  }

  async function confirmDelete(node: CategoryNode) {
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(node.id);
      setConfirmDeleteId(null);
    } catch (err) {
      setConfirmDeleteId(null);
      setActionError(translateError(err instanceof ApiError ? err.code : "error.internal"));
    }
  }

  // A refused favourite toggle is said out loud, like a refused delete.
  async function toggleFavorite(node: CategoryNode) {
    setActionError(null);
    try {
      await favoriteMutation.mutateAsync({ id: node.id, isFavorite: !node.isFavorite });
    } catch (err) {
      setActionError(translateError(err instanceof ApiError ? err.code : "error.internal"));
    }
  }

  const deletingId = deleteMutation.isPending ? (deleteMutation.variables ?? null) : null;
  const favoritePendingId = favoriteMutation.isPending ? (favoriteMutation.variables?.id ?? null) : null;

  return (
    <PageContainer>
      <PageHeader
        name="categories"
        title={t("title")}
        description={t("subtitle")}
        actions={
          canManage && (
            <Button className="shrink-0" onClick={openCreateForm} data-test-selector="add-category">
              <Plus className="size-4" aria-hidden="true" />
              {t("addCategory")}
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-4">
        {/* The star's effect is in the POS, so the screen says where. */}
        {canManage && <p className="text-label text-ink-muted">{t("favoritesHint")}</p>}

        {!canManage && <p className="text-label text-ink-muted">{t("readOnlyHint")}</p>}

        {actionError && (
          <Alert tone="danger" data-testid="alert-destructive">
            {actionError}
          </Alert>
        )}

        {isLoading ? (
          <CategoryListLoading />
        ) : isError ? (
          <CategoryListError error={error} onRetry={() => void refetch()} />
        ) : !tree || tree.length === 0 ? (
          <CategoryListEmpty />
        ) : (
          <CategoryTree
            nodes={tree}
            canManage={canManage}
            onEdit={openEditForm}
            onToggleFavorite={(node) => void toggleFavorite(node)}
            favoritePendingId={favoritePendingId}
            confirmDeleteId={confirmDeleteId}
            onRequestDelete={requestDelete}
            onCancelDelete={() => setConfirmDeleteId(null)}
            onConfirmDelete={(node) => void confirmDelete(node)}
            deletingId={deletingId}
          />
        )}

        {canManage && (
          <CategoryFormSheet
            open={formOpen}
            onOpenChange={setFormOpen}
            mode={formMode}
            category={editingCategory}
            tree={tree ?? []}
          />
        )}
      </div>
    </PageContainer>
  );
}
