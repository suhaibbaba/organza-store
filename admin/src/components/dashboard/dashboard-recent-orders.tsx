"use client";

import { useLocale, useTranslations } from "next-intl";
import { ReceiptText } from "lucide-react";
import { Skeleton, Typography } from "@store/ui";
import type { OrderSummary } from "@store/shared/types/order";
import { Link } from "@/i18n/navigation";
import { DetailCard } from "@/components/layout/detail-card";
import { ProductImage } from "@/components/products/product-image";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { useOrdersQuery } from "@/hooks/use-orders";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { formatTime } from "@/lib/format";
import { localize } from "@/lib/i18n-content";
import { DEFAULT_ORDER_FILTERS, ORDER_THUMB_SIZES } from "@/constants/orders";
import { DASHBOARD_RECENT_ORDERS } from "@/constants/dashboard";

const RECENT_FILTERS = {
  ...DEFAULT_ORDER_FILTERS,
  sortBy: "createdAt",
  sortDir: "desc",
  page: 1,
  pageSize: DASHBOARD_RECENT_ORDERS,
} as const;

// The newest orders, photos first: the shop knows a sale by the piece, not by its number.
export function DashboardRecentOrders() {
  const t = useTranslations("dashboard.recent");
  const { data, isLoading } = useOrdersQuery(RECENT_FILTERS);
  const orders = data?.orders ?? [];

  return (
    <DetailCard
      icon={ReceiptText}
      title={t("title")}
      data-testid="dashboard-recent-orders"
      className="animate-rise overflow-hidden px-0 pb-2 [animation-delay:350ms] [&>header]:px-5"
      action={
        <Link
          href="/orders"
          className="rounded-control text-label font-medium text-primary-700 transition-colors hover:text-primary-900 focus-link"
        >
          {t("all")}
        </Link>
      }
    >
      {isLoading ? (
        <div className="flex flex-col gap-2 px-5">
          {Array.from({ length: DASHBOARD_RECENT_ORDERS }).map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-control" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Typography variant="body" tone="muted" as="p" className="px-5 pb-3">
          {t("empty")}
        </Typography>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {orders.map((order) => (
            <RecentOrderRow key={order.id} order={order} />
          ))}
        </ul>
      )}
    </DetailCard>
  );
}

function RecentOrderRow({ order }: { order: OrderSummary }) {
  const tCard = useTranslations("orders.card");
  const tChannel = useTranslations("orders.channel");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const names = order.previewItems.map((item) => localize(item.name, locale)).join(" · ");

  return (
    <li data-test-selector={`dashboard-recent-order-${order.id}`}>
      <Link
        href={`/orders/${order.id}`}
        className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-row-hover focus-visible:bg-inset sm:gap-4"
      >
        <span className="flex w-16 shrink-0 sm:w-24" aria-hidden="true">
          {order.previewItems.map((item, index) => (
            <ProductImage
              key={item.id}
              src={item.thumbnailUrl}
              alt=""
              sizes={ORDER_THUMB_SIZES}
              className={
                index === 0
                  ? "size-11 rounded-control border-2 border-surface shadow-float"
                  : "-ms-5 hidden size-11 rounded-control border-2 border-surface shadow-float sm:block"
              }
            />
          ))}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Typography variant="body" weight="semibold" as="span" className="group-hover:text-primary-700">
            {tCard("orderNumber", { number: String(order.orderNumber) })}
            <Typography
              variant="small"
              tone="muted"
              as="span"
              className="block whitespace-nowrap font-normal sm:ms-1.5 sm:inline"
            >
              <span className="hidden sm:inline">· </span>
              {tChannel(order.channel)} · {formatTime(order.createdAt, locale)}
            </Typography>
          </Typography>
          <Typography variant="small" tone="muted" as="span" className="truncate">
            {names}
          </Typography>
        </span>

        <OrderStatusBadge status={order.status} className="hidden sm:inline-flex" />
        <span className="shrink-0 text-value font-bold tabular-nums">{formatMoney(order.total)}</span>
      </Link>
    </li>
  );
}
