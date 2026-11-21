"use client";

import { useLocale, useTranslations } from "next-intl";
import { MenuItem, RowMenu, useConfirm, useToast } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import type { ProductSummary } from "@store/shared/types/product";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { useDeleteAnyProductMutation } from "@/hooks/use-products";
import { localize } from "@/lib/i18n-content";
import { errorMessageKey } from "@/lib/error-message-key";

// Edit and soft delete (rule 4), each only for a role that may do it; one confirm dialog for the whole list.
export function useProductRowMenu() {
  const t = useTranslations("products");
  const locale = useLocale();
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const remove = useDeleteAnyProductMutation();
  const { confirm, dialog } = useConfirm("product-delete-confirm");
  const canEdit = can(user, "product.edit");
  const canDelete = can(user, "product.delete");

  function requestDelete(product: ProductSummary) {
    confirm({
      title: "products.detail.delete.title",
      titleValues: { name: localize(product.name, locale) },
      consequences: [t("detail.delete.consequence")],
      confirmLabel: "products.detail.delete.confirmAction",
      tone: "danger",
      onConfirm: async () => {
        try {
          await remove.mutateAsync(product.id);
          toast.success("products.detail.delete.success");
        } catch (error) {
          toast.error(errorMessageKey(error));
          throw error;
        }
      },
    });
  }

  function renderMenu(product: ProductSummary) {
    if (!canEdit && !canDelete) {
      return null;
    }
    return (
      <RowMenu
        data-testid={`product-menu-${product.id}`}
        label={t("rowMenu.label", { name: localize(product.name, locale) })}
      >
        {canEdit && (
          <MenuItem
            icon="edit"
            data-testid="product-menu-edit"
            onSelect={() => router.push(`/products/${product.id}/edit`)}
          >
            {t("rowMenu.edit")}
          </MenuItem>
        )}
        {canDelete && (
          <MenuItem
            icon="trash"
            tone="danger"
            data-testid="product-menu-delete"
            onSelect={() => requestDelete(product)}
          >
            {t("rowMenu.delete")}
          </MenuItem>
        )}
      </RowMenu>
    );
  }

  return { renderMenu, dialog, hasMenu: canEdit || canDelete };
}
