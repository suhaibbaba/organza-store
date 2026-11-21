"use client";

import { useLocale, useTranslations } from "next-intl";
import { Checkbox, Typography } from "@store/ui";
import { cn } from "@/lib/utils";
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
    // The card is a mouse/touch convenience; the Checkbox is the control screen readers and keyboards use.
    <div
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-card border p-3 shadow-card transition-colors",
        selected ? "border-selected-line bg-selected" : "border-line bg-surface hover:border-primary-300"
      )}
      data-test-selector={testSelectorFor("collection-order-row", order.id)}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest("label")) onToggle(order.id);
      }}
    >
      <Checkbox
        id={`collect-${order.id}`}
        data-testid={testSelectorFor("collection-order-check", order.id)}
        label={tCollection("selectOrder", { number: String(order.orderNumber), amount: formatMoney(order.outstanding ?? order.total) })}
        hideLabel
        checked={selected}
        onCheckedChange={() => onToggle(order.id)}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <Typography variant="small" weight="semibold" as="span" className="truncate">
            {t("orderNumber", { number: String(order.orderNumber) })}
          </Typography>
          <Typography variant="h3" weight="semibold" as="span" className="shrink-0 tabular-nums">
            {formatMoney(order.outstanding ?? order.total)}
          </Typography>
        </div>

        {order.customerName && (
          <Typography variant="small" tone="muted" as="span" className="truncate">{order.customerName}</Typography>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} className="min-w-0 max-w-full shrink" />
          <OrderChannelBadge channel={order.channel} />
          <Typography variant="caption" tone="muted">{formatDate(order.createdAt, locale)}</Typography>
        </div>
      </div>
    </div>
  );
}
