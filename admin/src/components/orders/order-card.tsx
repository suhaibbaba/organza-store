import { useLocale, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import type { OrderSummary } from "@shared/types/order";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { OrderChannelBadge } from "@/components/orders/order-channel-badge";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";

// One order, as a card. This is the primary (mobile) rendering — the table
// below md is a convenience for desktop, not the other way round (CLAUDE.md
// "Tables become cards on mobile").
//
// The whole card is one tap target: an untrained user should never have to
// find a small link inside a row.
export function OrderCard({ order }: { order: OrderSummary }) {
  const t = useTranslations("orders.card");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  return (
    <div className="relative flex flex-col gap-2 rounded-xl border border-border bg-card p-3 transition-colors has-[a:active]:bg-accent">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/orders/${order.id}`}
            className="block rounded-md after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-1">
              <span className="truncate text-sm font-semibold text-foreground">
                {t("orderNumber", { number: String(order.orderNumber) })}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden="true" />
            </span>
          </Link>
          {/* Only online orders carry a customer — a counter sale is handed
              over to whoever is standing there (spec.md). */}
          {order.customerName && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{order.customerName}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <OrderStatusBadge status={order.status} />
          <OrderChannelBadge channel={order.channel} />
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 border-t border-border pt-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{formatDate(order.createdAt, locale)}</p>
          <p className="truncate text-xs text-muted-foreground">{t("itemCount", { count: order.itemCount })}</p>
        </div>
        <span className="shrink-0 text-base font-semibold tabular-nums text-foreground">
          {formatMoney(order.total)}
        </span>
      </div>
    </div>
  );
}
