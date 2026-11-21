import { useLocale, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import type { OrderSummary } from "@organza/shared/types/order";
import { Link } from "@/i18n/navigation";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { formatDate } from "@/lib/format";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { isOrderCollectable } from "@organza/shared/lib/orders";
import { OrderChannelBadge } from "@/components/orders/order-channel-badge";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderTypeBadge } from "@/components/orders/order-type-badge";
import { PaymentStatusBadge } from "@/components/orders/payment-status-badge";
import { QuickSaleBadge } from "@/components/orders/quick-sale-badge";

// The primary (mobile) rendering of an order; the whole card is one tap target.
export function OrderCard({ order }: { order: OrderSummary }) {
  const t = useTranslations("orders.card");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  return (
    <div
      className="relative flex flex-col gap-2 rounded-card border border-line bg-surface p-3 shadow-card transition-colors has-[a:active]:bg-inset"
      data-test-selector={testSelectorFor("order-card", order.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/orders/${order.id}`}
            className="block rounded-control after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <span className="flex items-center gap-1">
              <span className="truncate text-label font-semibold text-ink">
                {t("orderNumber", { number: String(order.orderNumber) })}
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-muted rtl:-scale-x-100" aria-hidden="true" />
            </span>
          </Link>
          {/* Only online orders carry a customer (spec.md). */}
          {order.customerName && (
            <p className="mt-0.5 truncate text-label text-ink-muted">{order.customerName}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <OrderStatusBadge status={order.status} />
          <OrderChannelBadge channel={order.channel} />
          <OrderTypeBadge type={order.type} />
          {order.hasQuickSale && <QuickSaleBadge />}
          {/* Only money still with the courier is flagged; a cancelled or returned sale owes nothing. */}
          {order.paymentStatus === "PENDING_COLLECTION" && isOrderCollectable(order.status) && (
            <PaymentStatusBadge status={order.paymentStatus} />
          )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 border-t border-line pt-2">
        <div className="min-w-0">
          <p className="truncate text-micro text-ink-muted">{formatDate(order.createdAt, locale)}</p>
          <p className="truncate text-micro text-ink-muted">{t("itemCount", { count: order.itemCount })}</p>
        </div>
        <span className="shrink-0 text-section font-semibold tabular-nums text-ink">
          {formatMoney(order.total)}
        </span>
      </div>
    </div>
  );
}
