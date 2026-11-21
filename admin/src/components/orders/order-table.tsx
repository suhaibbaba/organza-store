"use client";

import { useLocale, useTranslations } from "next-intl";
import { Table, type Column, type TableSort, Typography } from "@store/ui";
import type { OrderPreviewItem, OrderSummary } from "@organza/shared/types/order";
import type { Pagination } from "@organza/shared/types/common";
import { PAGE_SIZE_OPTIONS } from "@organza/shared/constants/pagination";
import { isOrderCollectable } from "@organza/shared/lib/orders";
import { Link } from "@/i18n/navigation";
import { formatDate, formatTime } from "@/lib/format";
import { localize } from "@/lib/i18n-content";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { ORDER_THUMB_SIZES } from "@/constants/orders";
import { ProductImage } from "@/components/products/product-image";
import { useOrderRowMenu } from "@/components/orders/order-row-menu";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderTypeBadge } from "@/components/orders/order-type-badge";
import { QuickSaleBadge } from "@/components/orders/quick-sale-badge";
import { PaymentStatusBadge } from "@/components/orders/payment-status-badge";

// Rows are named `orders-row-<id>` by the Table (its data-testid + "-row-" + rowKey).
const TABLE_NAME = "orders";

interface OrderTableProps {
  orders: OrderSummary[];
  meta: Pagination | null;
  isRefreshing: boolean;
  sort: TableSort;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function OrderTable({ orders, meta, isRefreshing, sort, onPageChange, onPageSizeChange }: OrderTableProps) {
  const locale = useLocale();
  const t = useTranslations("orders");
  const formatMoney = useMoneyFormatter();
  const menu = useOrderRowMenu();

  function pieceName(item: OrderPreviewItem) {
    const name = localize(item.name, locale);
    const variant = item.variantName ? ` (${localize(item.variantName, locale)})` : "";
    const quantity = item.quantity > 1 ? ` ${t("card.quantity", { count: item.quantity })}` : "";
    return `${name}${variant}${quantity}`;
  }

  function renderPhotos(order: OrderSummary) {
    const more = order.itemCount - order.previewItems.length;
    return (
      <Link
        href={`/orders/${order.id}`}
        tabIndex={-1}
        aria-hidden="true"
        data-test-selector="order-photos"
        className="flex shrink-0 items-center gap-1.5"
      >
        {order.previewItems.map((item, index) => (
          <span key={item.id} className="relative">
            <ProductImage
              src={item.thumbnailUrl}
              alt={pieceName(item)}
              className="size-16 rounded-control md:size-12"
              sizes={ORDER_THUMB_SIZES}
            />
            {more > 0 && index === order.previewItems.length - 1 && (
              <Typography variant="body" weight="medium" as="span" className="absolute inset-0 flex items-center justify-center rounded-control bg-ink/55 text-ink-inverse tabular-nums" data-test-selector="order-pieces-more"
                dir="ltr">
                {t("card.morePieces", { count: more })}
              </Typography>
            )}
          </span>
        ))}
      </Link>
    );
  }

  function renderOrder(order: OrderSummary) {
    return (
      <div className="flex flex-col gap-3">
        <div className="md:hidden">{renderPhotos(order)}</div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/orders/${order.id}`}
              className="whitespace-nowrap rounded-control text-value font-medium text-ink transition-colors hover:text-primary-700 focus-link"
            >
              {t("card.orderNumber", { number: String(order.orderNumber) })}
            </Link>
            {/* A gift changes what the total means, so it is badged on the order itself. */}
            <OrderTypeBadge type={order.type} />
            {order.hasQuickSale && <QuickSaleBadge />}
          </div>
          <Typography variant="small" tone="muted" as="span" className="line-clamp-2 font-normal" data-test-selector="order-pieces-names">
            {order.previewItems.map(pieceName).join(" · ")}
            {order.itemCount > order.previewItems.length &&
              ` · ${t("card.morePieces", { count: order.itemCount - order.previewItems.length })}`}
          </Typography>
        </div>
      </div>
    );
  }

  const columns: Column<OrderSummary>[] = [
    {
      key: "order",
      header: "orders.table.orderNumber",
      primary: true,
      sortKey: "orderNumber",
      // Two lines of piece names need more room than the Table's default cell cap.
      className: "min-w-[13rem] [--cell-max:22rem]",
      render: renderOrder,
    },
    {
      key: "photos",
      header: "orders.table.photos",
      hideOnMobile: true,
      render: renderPhotos,
    },
    {
      key: "status",
      header: "orders.table.status",
      render: (order) => <OrderStatusBadge status={order.status} className="whitespace-nowrap" />,
    },
    {
      key: "payment",
      header: "orders.table.payment",
      // A cancelled or returned sale owes nothing, so it carries no payment state.
      render: (order) =>
        isOrderCollectable(order.status) ? (
          <PaymentStatusBadge status={order.paymentStatus} className="whitespace-nowrap" />
        ) : null,
    },
    {
      key: "createdAt",
      header: "orders.table.date",
      sortKey: "createdAt",
      render: (order) => (
        <div className="flex flex-col whitespace-nowrap tabular-nums">
          <Typography variant="body" as="span">{formatDate(order.createdAt, locale)}</Typography>
          <Typography variant="small" tone="muted" as="span">{formatTime(order.createdAt, locale)}</Typography>
        </div>
      ),
    },
    {
      key: "total",
      header: "orders.table.total",
      sortKey: "total",
      align: "numeric",
      render: (order) => (
        <Typography variant="body" weight="medium" as="span" className="whitespace-nowrap tabular-nums">{formatMoney(order.total)}</Typography>
      ),
    },
    {
      key: "actions",
      header: "orders.table.actions",
      actions: true,
      besideTitleOnMobile: true,
      align: "end",
      className: "align-top",
      render: menu.renderMenu,
    },
  ];

  return (
    <>
      <Table
        data-testid={TABLE_NAME}
        columns={columns}
        rows={orders}
        rowKey={(order) => order.id}
        isRefreshing={isRefreshing}
        sort={sort}
        {...(meta && {
          pagination: {
            "data-testid": "orders-pagination",
            page: meta.page,
            totalPages: Math.max(meta.totalPages, 1),
            perPage: meta.pageSize,
            perPageOptions: PAGE_SIZE_OPTIONS,
            onPageChange,
            onPerPageChange: onPageSizeChange,
          },
        })}
      />
      {menu.dialog}
    </>
  );
}
