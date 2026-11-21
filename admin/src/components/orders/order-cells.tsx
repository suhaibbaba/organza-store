"use client";

import { useLocale, useTranslations } from "next-intl";
import { Typography } from "@store/ui";
import type { OrderPreviewItem, OrderSummary } from "@store/shared/types/order";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/i18n-content";
import { ORDER_THUMB_SIZES } from "@/constants/orders";
import { ProductImage } from "@/components/products/product-image";
import { OrderTypeBadge } from "@/components/orders/order-type-badge";
import { QuickSaleBadge } from "@/components/orders/quick-sale-badge";

function usePieceName() {
  const locale = useLocale();
  const t = useTranslations("orders.card");
  return (item: OrderPreviewItem) => {
    const name = localize(item.name, locale);
    const variant = item.variantName ? ` (${localize(item.variantName, locale)})` : "";
    const quantity = item.quantity > 1 ? ` ${t("quantity", { count: item.quantity })}` : "";
    return `${name}${variant}${quantity}`;
  };
}

// Up to three pieces, dearest first; the last one dimmed with "+N" when the order has more.
export function OrderPhotos({ order }: { order: OrderSummary }) {
  const t = useTranslations("orders.card");
  const pieceName = usePieceName();
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
            <Typography
              variant="body"
              weight="medium"
              as="span"
              dir="ltr"
              className="absolute inset-0 flex items-center justify-center rounded-control bg-ink/55 text-ink-inverse tabular-nums"
              data-test-selector="order-pieces-more"
            >
              {t("morePieces", { count: more })}
            </Typography>
          )}
        </span>
      ))}
    </Link>
  );
}

// Order number (+ gift / quick-sale badges) over the piece names; photos on top on phones, where there is no photo column.
export function OrderTitle({ order, subtitle }: { order: OrderSummary; subtitle?: string | null }) {
  const t = useTranslations("orders.card");
  const pieceName = usePieceName();

  return (
    <div className="flex flex-col gap-3">
      <div className="md:hidden">
        <OrderPhotos order={order} />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/orders/${order.id}`}
            className="whitespace-nowrap rounded-control text-value font-medium text-ink transition-colors hover:text-primary-700 focus-link"
          >
            {t("orderNumber", { number: String(order.orderNumber) })}
          </Link>
          <OrderTypeBadge type={order.type} />
          {order.hasQuickSale && <QuickSaleBadge />}
        </div>
        {subtitle && (
          <Typography variant="small" weight="medium" as="span" className="truncate" data-test-selector="order-customer-name">
            {subtitle}
          </Typography>
        )}
        <Typography variant="small" tone="muted" as="span" className="line-clamp-2" data-test-selector="order-pieces-names">
          {order.previewItems.map(pieceName).join(" · ")}
          {order.itemCount > order.previewItems.length &&
            ` · ${t("morePieces", { count: order.itemCount - order.previewItems.length })}`}
        </Typography>
      </div>
    </div>
  );
}
