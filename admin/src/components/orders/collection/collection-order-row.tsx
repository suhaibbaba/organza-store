"use client";

import { useLocale, useTranslations } from "next-intl";
import type { OrderSummary } from "@organza/shared/types/order";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { formatDate } from "@/lib/format";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { OrderChannelBadge } from "@/components/orders/order-channel-badge";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";

interface CollectionOrderRowProps {
  order: OrderSummary;
  selected: boolean;
  onToggle: (id: string) => void;
}

// The whole row toggles the checkbox; deliberately not a link, so a stray tap never loses the batch selection.
export function CollectionOrderRow({ order, selected, onToggle }: CollectionOrderRowProps) {
  const t = useTranslations("orders.card");
  const tCollection = useTranslations("orders.collection");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  return (
    <label
      className="flex cursor-pointer items-center gap-3 rounded-card border border-line bg-surface p-3 shadow-card transition-colors has-[input:checked]:border-selected-line has-[input:checked]:bg-selected"
      data-test-selector={testSelectorFor("collection-order-row", order.id)}
      aria-label={tCollection("selectOrder", {
        number: String(order.orderNumber),
        amount: formatMoney(order.total),
      })}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(order.id)}
        className="size-5 shrink-0 cursor-pointer accent-primary-600 focus-darken"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-label font-semibold text-ink">
            {t("orderNumber", { number: String(order.orderNumber) })}
          </span>
          <span className="shrink-0 text-section font-semibold tabular-nums text-ink">
            {formatMoney(order.total)}
          </span>
        </div>

        {order.customerName && (
          <span className="truncate text-label text-ink-muted">{order.customerName}</span>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <OrderChannelBadge channel={order.channel} />
          <span className="text-micro text-ink-muted">{formatDate(order.createdAt, locale)}</span>
        </div>
      </div>
    </label>
  );
}
