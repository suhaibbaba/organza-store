"use client";

import { useTranslations } from "next-intl";
import { useConfirm, useToast } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { ERROR_CODES } from "@store/shared/constants/errors";
import type { Product } from "@store/shared/types/product";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { useDeleteProductMutation } from "@/hooks/use-products";
import { ApiError } from "@/lib/api/errors";
import { localize } from "@/lib/i18n-content";

// Soft delete (rule 4) behind product.delete (rule 5): past orders still point at the row; the backend refuses anyone else.
export function useProductDelete(product: Product, locale: string) {
  const t = useTranslations("products.detail.delete");
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const deleteMutation = useDeleteProductMutation(product.id);
  const { confirm, dialog } = useConfirm("product-delete-confirm");

  function requestDelete() {
    confirm({
      title: "products.detail.delete.title",
      titleValues: { name: localize(product.name, locale) },
      consequences: [t("consequence")],
      confirmLabel: "products.detail.delete.confirmAction",
      tone: "danger",
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync();
          toast.success("products.detail.delete.success");
          router.replace("/products");
        } catch (error) {
          toast.error(error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL);
          throw error;
        }
      },
    });
  }

  return { canDelete: can(user, "product.delete"), requestDelete, dialog };
}
