"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import type { CategoryNode } from "@shared/types/category";
import { can } from "@shared/lib/permissions";
import { useSession } from "@/components/providers/session-provider";
import {
  useCategoriesQuery,
  useDeleteCategoryMutation,
  useToggleCategoryFavoriteMutation,
} from "@/hooks/use-categories";
import { useTranslateError } from "@/hooks/use-translate-error";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
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

  // Pinning a shelf to the front of the POS browser is a save like any
  // other, so a refused one is said out loud in the same place a refused
  // delete is — silently leaving the star where it was is how somebody ends
  // up believing every till has been re-ordered when nothing has.
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
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          {/* The star on each row is the only control on this screen whose
              effect is somewhere else entirely, so the screen says where. */}
          {canManage && <p className="mt-1 text-sm text-muted-foreground">{t("favoritesHint")}</p>}
        </div>
        {canManage && (
          <Button size="sm" className="shrink-0" onClick={openCreateForm}>
            <Plus className="size-4" aria-hidden="true" />
            {t("addCategory")}
          </Button>
        )}
      </div>

      {!canManage && <p className="text-sm text-muted-foreground">{t("readOnlyHint")}</p>}

      {actionError && <Alert variant="destructive">{actionError}</Alert>}

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
  );
}
