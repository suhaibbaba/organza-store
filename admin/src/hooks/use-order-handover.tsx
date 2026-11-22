"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useConfirm, useToast } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import type { Order, OrderItem } from "@store/shared/types/order";
import { useSession } from "@/components/providers/session-provider";
import { useHandOverItemsMutation } from "@/hooks/use-customers";
import { errorMessageKey } from "@/lib/error-message-key";
import { localize } from "@/lib/i18n-content";

// Handing a kept piece to the customer, confirmed first: it is recorded with who did it and when.
export function useOrderHandover(order: Order | undefined) {
  const locale = useLocale();
  const t = useTranslations("orders.detail.handover");
  const { user } = useSession();
  const toast = useToast();
  const mutation = useHandOverItemsMutation();
  const { confirm, dialog } = useConfirm("order-handover-confirm");
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  function onHandOver(item: OrderItem) {
    confirm({
      title: "orders.detail.handover.confirmTitle",
      titleValues: { name: localize(item.name, locale) },
      consequences: [t("confirmConsequence")],
      confirmLabel: "orders.detail.handover.confirmAction",
      tone: "primary",
      onConfirm: async () => {
        setPendingItemId(item.id);
        try {
          await mutation.mutateAsync({ orderId: order!.id, itemIds: [item.id] });
          toast.success("orders.detail.handover.done");
        } catch (error) {
          toast.error(errorMessageKey(error));
          throw error;
        } finally {
          setPendingItemId(null);
        }
      },
    });
  }

  const controls =
    order?.onCredit && order.status !== "CANCELLED"
      ? { canHandOver: can(user, "order.markHandedOver"), pendingItemId, onHandOver }
      : undefined;
  return { controls, dialog };
}
