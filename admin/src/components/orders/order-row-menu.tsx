"use client";

import { useTranslations } from "next-intl";
import { MenuItem, RowMenu, useConfirm, useToast } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { isOrderCollectable } from "@store/shared/lib/orders";
import type { OrderSummary } from "@store/shared/types/order";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { useCollectOrdersMutation } from "@/hooks/use-orders";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { ApiError } from "@/lib/api/errors";

// One confirm dialog for the whole list; `dialog` is rendered once beside the table.
export function useOrderRowMenu() {
  const t = useTranslations("orders.rowMenu");
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const formatMoney = useMoneyFormatter();
  const collect = useCollectOrdersMutation();
  const { confirm, dialog } = useConfirm("order-collect-confirm");
  const canCollect = can(user, "order.markCollected");

  function requestCollect(order: OrderSummary) {
    confirm({
      title: "orders.rowMenu.confirmTitle",
      titleValues: { number: order.orderNumber },
      consequences: [t("confirmConsequence", { amount: formatMoney(order.outstanding ?? order.total) })],
      confirmLabel: "orders.rowMenu.confirmAction",
      tone: "primary",
      onConfirm: async () => {
        try {
          await collect.mutateAsync([order.id]);
          toast.success("orders.rowMenu.collected");
        } catch (error) {
          toast.error(error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL);
          throw error;
        }
      },
    });
  }

  function renderMenu(order: OrderSummary) {
    const collectable = canCollect && order.paymentStatus === "PENDING_COLLECTION" && isOrderCollectable(order.status);
    return (
      <RowMenu data-testid={`order-menu-${order.id}`} label={t("label", { number: order.orderNumber })}>
        <MenuItem icon="eye" data-testid="order-menu-open" onSelect={() => router.push(`/orders/${order.id}`)}>
          {t("open")}
        </MenuItem>
        {collectable && (
          <MenuItem icon="check" data-testid="order-menu-collect" onSelect={() => requestCollect(order)}>
            {t("markCollected")}
          </MenuItem>
        )}
      </RowMenu>
    );
  }

  return { renderMenu, dialog };
}
