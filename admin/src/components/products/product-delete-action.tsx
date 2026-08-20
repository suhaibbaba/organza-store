"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { can } from "@organza/shared/lib/permissions";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import type { Product } from "@organza/shared/types/product";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { useDeleteProductMutation } from "@/hooks/use-products";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

// Deleting a product is Admin/Manager only (CLAUDE.md rule 5) and is a soft
// delete (rule 4): the row survives, because past orders point at it, and
// the product simply disappears from every screen. The button is hidden for
// anyone without the permission — and the backend refuses them regardless.
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
        // Nothing left on this screen to look at — say plainly what happened
        // and go back to the list the product has just left.
        setDone(true);
        router.replace("/products");
      },
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        {deleteMutation.isError && (
          <Alert variant="destructive">
            {translateError(deleteMutation.error instanceof ApiError ? deleteMutation.error.code : ERROR_CODES.INTERNAL)}
          </Alert>
        )}

        {done ? (
          <Alert>{t("success")}</Alert>
        ) : confirming ? (
          <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            {/* Plain language about what "delete" actually does here: the
                product leaves every screen, and past orders keep it. */}
            <p className="text-sm text-foreground">{t("confirm")}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                disabled={deleteMutation.isPending}
                onClick={handleDelete}
                data-test-selector="product-delete-confirm"
              >
                {deleteMutation.isPending && <Spinner />}
                {t("confirmAction")}
              </Button>
              <Button
                type="button"
                variant="outline"
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
            type="button"
            variant="ghost"
            className="w-full text-destructive sm:w-auto sm:self-start"
            onClick={() => setConfirming(true)}
            data-test-selector="product-delete"
          >
            <Trash2 className="size-5" aria-hidden="true" />
            {t("action")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
