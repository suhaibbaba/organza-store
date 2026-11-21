"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, Undo2 } from "lucide-react";
import { Alert, Button, Card } from "@store/ui";
import { can } from "@organza/shared/lib/permissions";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { RETURNABLE_ORDER_STATUSES } from "@organza/shared/constants/order";
import type { Order } from "@organza/shared/types/order";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { useDeleteOrderMutation } from "@/hooks/use-orders";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { OrderReturnSheet } from "@/components/orders/detail/order-return-sheet";

// Anti-theft (spec.md): whoever rang an order up must not erase it, so return/delete are permission-gated (backend enforces too).
export function OrderManageActions({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.manage");
  const { user } = useSession();
  const router = useRouter();
  const translateError = useTranslateError();
  const deleteMutation = useDeleteOrderMutation(order.id);

  const [returnOpen, setReturnOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Goods must have reached the customer to come back; a partially returned order can be returned again.
  const isReturnable = (RETURNABLE_ORDER_STATUSES as readonly string[]).includes(order.status);
  const canReturn = can(user, "order.return") && isReturnable;
  const canDelete = can(user, "order.delete");

  if (!canReturn && !canDelete) return null;

  function handleDelete() {
    deleteMutation.mutate(undefined, {
      onSuccess: () => router.replace("/orders"),
    });
  }

  return (
    <>
      <Card className="flex flex-col gap-3">
        {deleteMutation.isError && (
          <Alert tone="danger" data-testid="alert-destructive">
            {translateError(
              deleteMutation.error instanceof ApiError ? deleteMutation.error.code : ERROR_CODES.INTERNAL
            )}
          </Alert>
        )}

        {canReturn && (
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto sm:self-start"
            onClick={() => setReturnOpen(true)}
            data-test-selector="order-return"
            icon={<Undo2 className="size-5 rtl:-scale-x-100" aria-hidden="true" />}
          >
            {t("returnItems")}
          </Button>
        )}

        {canDelete &&
          (confirmingDelete ? (
            <div className="flex flex-col gap-2 rounded-panel border border-danger-200 bg-danger-50 p-3">
              {/* A soft delete that also puts committed stock back on the shelf; "delete" alone sounds like losing the record. */}
              <p className="text-label text-ink">
                {order.stockDeductedAt ? t("confirmDeleteWithStock") : t("confirmDelete")}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="danger"
                  className="flex-1"
                  isLoading={deleteMutation.isPending}
                  onClick={handleDelete}
                  data-test-selector="order-delete-confirm"
                >
                  {t("confirmDeleteAction")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setConfirmingDelete(false)}
                  data-test-selector="order-delete-abort"
                >
                  {t("keepOrder")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="quiet"
              className="w-full text-danger-600 hover:text-danger-700 sm:w-auto sm:self-start"
              onClick={() => setConfirmingDelete(true)}
              data-test-selector="order-delete"
              icon={<Trash2 className="size-5" aria-hidden="true" />}
            >
              {t("deleteOrder")}
            </Button>
          ))}
      </Card>

      {canReturn && <OrderReturnSheet order={order} open={returnOpen} onOpenChange={setReturnOpen} />}
    </>
  );
}
