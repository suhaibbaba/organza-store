"use client";

import { useLocale, useTranslations } from "next-intl";
import type { OrderSummary } from "@organza/shared/types/order";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate } from "@/lib/format";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { OrderChannelBadge } from "@/components/orders/order-channel-badge";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";

interface CollectionOrderRowProps {
  order: OrderSummary;
  selected: boolean;
  onToggle: (id: string) => void;
}

// One outstanding order, as a row that is entirely one tap target: the whole
// card toggles its checkbox, so nobody has to hit a small square on a phone.
//
// Deliberately not a link to the order: this screen is for ticking off a
// batch the delivery company just paid for, and a stray tap that navigates
// away would lose the selection.
export function CollectionOrderRow({ order, selected, onToggle }: CollectionOrderRowProps) {
  const t = useTranslations("orders.card");
  const tCollection = useTranslations("orders.collection");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  return (
    <label
      className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5"
      // Names the row for a screen reader, since the visible text is split
      // across several lines rather than one label.
      aria-label={tCollection("selectOrder", {
        number: String(order.orderNumber),
        amount: formatMoney(order.total),
      })}
    >
      <Checkbox checked={selected} onCheckedChange={() => onToggle(order.id)} />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {t("orderNumber", { number: String(order.orderNumber) })}
          </span>
          <span className="shrink-0 text-base font-semibold tabular-nums text-foreground">
            {formatMoney(order.total)}
          </span>
        </div>

        {order.customerName && (
          <span className="truncate text-sm text-muted-foreground">{order.customerName}</span>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <OrderChannelBadge channel={order.channel} />
          <span className="text-xs text-muted-foreground">{formatDate(order.createdAt, locale)}</span>
        </div>
      </div>
    </label>
  );
}
