"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, Undo2 } from "lucide-react";
import { can } from "@shared/lib/permissions";
import { ERROR_CODES } from "@shared/constants/errors";
import { RETURNABLE_ORDER_STATUSES } from "@shared/constants/order";
import type { Order } from "@shared/types/order";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { useDeleteOrderMutation } from "@/hooks/use-orders";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { OrderReturnSheet } from "@/components/orders/detail/order-return-sheet";

// The two actions that undo a sale. Both are Admin/Manager only — spec.md's
// anti-theft rule is that the person who rang an order up must not be able to
// erase it, so an Employee sees neither button (and the backend refuses both
// regardless: CLAUDE.md rule 5).
export function OrderManageActions({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.manage");
  const { user } = useSession();
  const router = useRouter();
  const translateError = useTranslateError();
  const deleteMutation = useDeleteOrderMutation(order.id);

  const [returnOpen, setReturnOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // The goods have to have reached the customer before they can come back,
  // and a partially returned order can still be returned again.
  const isReturnable = (RETURNABLE_ORDER_STATUSES as readonly string[]).includes(order.status);
  const canReturn = can(user, "order.return") && isReturnable;
  const canDelete = can(user, "order.delete");

  if (!canReturn && !canDelete) return null;

  function handleDelete() {
    deleteMutation.mutate(undefined, {
      // The order is now hidden from every list, so there is nothing left on
      // this screen to look at.
      onSuccess: () => router.replace("/orders"),
    });
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          {deleteMutation.isError && (
            <Alert variant="destructive">
              {translateError(
                deleteMutation.error instanceof ApiError ? deleteMutation.error.code : ERROR_CODES.INTERNAL
              )}
            </Alert>
          )}

          {canReturn && (
            <Button type="button" variant="outline" className="w-full sm:w-auto sm:self-start" onClick={() => setReturnOpen(true)}>
              <Undo2 className="size-5 rtl:-scale-x-100" aria-hidden="true" />
              {t("returnItems")}
            </Button>
          )}

          {canDelete &&
            (confirmingDelete ? (
              <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                {/* Deleting is a soft delete that also puts anything still
                    committed back on the shelf — worth saying, since "delete"
                    on its own sounds like it loses the record. */}
                <p className="text-sm text-foreground">
                  {order.stockDeductedAt ? t("confirmDeleteWithStock") : t("confirmDelete")}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1"
                    disabled={deleteMutation.isPending}
                    onClick={handleDelete}
                  >
                    {deleteMutation.isPending && <Spinner />}
                    {t("confirmDeleteAction")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setConfirmingDelete(false)}
                  >
                    {t("keepOrder")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-destructive sm:w-auto sm:self-start"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 className="size-5" aria-hidden="true" />
                {t("deleteOrder")}
              </Button>
            ))}
        </CardContent>
      </Card>

      {canReturn && <OrderReturnSheet order={order} open={returnOpen} onOpenChange={setReturnOpen} />}
    </>
  );
}
