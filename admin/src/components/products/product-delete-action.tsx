"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Alert, Button, Card } from "@store/ui";
import { can } from "@organza/shared/lib/permissions";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import type { Product } from "@organza/shared/types/product";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { useDeleteProductMutation } from "@/hooks/use-products";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

// Soft delete (rule 4) behind product.delete (rule 5): past orders still point at the row; the backend refuses anyone else.
export function ProductDeleteAction({ product }: { product: Product }) {
  const t = useTranslations("products.detail.delete");
  const { user } = useSession();
  const router = useRouter();
  const translateError = useTranslateError();
  const deleteMutation = useDeleteProductMutation(product.id);

  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  if (!can(user, "product.delete")) return null;

  function handleDelete() {
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        setDone(true);
        router.replace("/products");
      },
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      {deleteMutation.isError && (
        <Alert tone="danger">
          {translateError(deleteMutation.error instanceof ApiError ? deleteMutation.error.code : ERROR_CODES.INTERNAL)}
        </Alert>
      )}

      {done ? (
        <Alert tone="success">{t("success")}</Alert>
      ) : confirming ? (
        <div className="flex flex-col gap-2 rounded-panel border border-danger-200 bg-danger-50 p-3">
          <p className="text-label text-ink">{t("confirm")}</p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              className="flex-1"
              isLoading={deleteMutation.isPending}
              onClick={handleDelete}
              data-test-selector="product-delete-confirm"
            >
              {t("confirmAction")}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setConfirming(false)}
              data-test-selector="product-delete-abort"
            >
              {t("keep")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="quiet"
          className="w-full text-danger-600 hover:text-danger-700 sm:w-auto sm:self-start"
          onClick={() => setConfirming(true)}
          data-test-selector="product-delete"
          icon={<Trash2 className="size-5" aria-hidden="true" />}
        >
          {t("action")}
        </Button>
      )}
    </Card>
  );
}
