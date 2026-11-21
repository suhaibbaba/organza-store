"use client";

import { useLocale, useTranslations } from "next-intl";
import { MenuItem, RowMenu, useConfirm, useToast } from "@store/ui";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import type { CategoryNode } from "@store/shared/types/category";
import { useDeleteCategoryMutation } from "@/hooks/use-categories";
import { localize } from "@/lib/i18n-content";
import type { CategoryFormTarget } from "@/types/category";
import { errorMessageKey } from "@/lib/error-message-key";

export function useCategoryRowMenu(onOpenForm: (target: CategoryFormTarget) => void) {
  const t = useTranslations("categories");
  const locale = useLocale();
  const toast = useToast();
  const remove = useDeleteCategoryMutation();
  const { confirm, dialog } = useConfirm("category-delete-confirm");

  function requestDelete(node: CategoryNode) {
    confirm({
      title: "categories.delete.title",
      titleValues: { name: localize(node.name, locale) },
      consequences: [t("delete.consequence")],
      confirmLabel: "categories.delete.confirm",
      tone: "danger",
      onConfirm: async () => {
        try {
          await remove.mutateAsync(node.id);
          toast.success("categories.delete.success");
        } catch (error) {
          toast.error(errorMessageKey(error));
          throw error;
        }
      },
    });
  }

  function renderMenu(node: CategoryNode) {
    return (
      <RowMenu
        data-testid={testSelectorFor("category-menu", node.id)}
        label={t("menu.label", { name: localize(node.name, locale) })}
      >
        <MenuItem
          icon="edit"
          data-testid="category-menu-edit"
          onSelect={() => onOpenForm({ mode: "edit", category: node })}
        >
          {t("menu.edit")}
        </MenuItem>
        <MenuItem
          icon="plus"
          data-testid="category-menu-add-child"
          onSelect={() => onOpenForm({ mode: "create", parentId: node.id })}
        >
          {t("menu.addChild")}
        </MenuItem>
        <MenuItem icon="trash" tone="danger" data-testid="category-menu-delete" onSelect={() => requestDelete(node)}>
          {t("menu.delete")}
        </MenuItem>
      </RowMenu>
    );
  }

  return { renderMenu, dialog };
}
