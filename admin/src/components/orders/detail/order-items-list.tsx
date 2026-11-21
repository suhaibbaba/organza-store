import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Package, Undo2, Zap } from "lucide-react";
import { Table, type Column, Typography } from "@store/ui";
import type { OrderItem } from "@store/shared/types/order";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { SELECTABLE } from "@store/shared/lib/nativeGestures";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/i18n-content";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { ORDER_THUMB_SIZES } from "@/constants/orders";
import { ProductImage } from "@/components/products/product-image";
import { DetailCard } from "@/components/layout/detail-card";

// Rows are named `order-item-row-<id>` by the Table; the cell keeps the old `order-item-<id>` name too.
const TABLE_NAME = "order-item";

export function OrderItemsList({ items, footer }: { items: OrderItem[]; footer?: ReactNode }) {
  const t = useTranslations("orders.detail.items");
  const tDiscount = useTranslations("orders.discount");
  const tCard = useTranslations("orders.card");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  function renderDiscount(item: OrderItem) {
    if (item.discountType === null || Number(item.discountAmount) <= 0) return null;
    return (
      <div className="flex flex-col whitespace-nowrap">
        <Typography variant="body" tone="success" as="span" className="tabular-nums" dir="ltr">
          −{formatMoney(item.discountAmount)}
        </Typography>
        {item.discountType === "PERCENT" && (
          <Typography variant="small" tone="muted" as="span">
            {tDiscount("percentValue", { value: Number(item.discountValue ?? 0) })}
          </Typography>
        )}
      </div>
    );
  }

  const columns: Column<OrderItem>[] = [
    {
      key: "piece",
      header: "orders.detail.items.piece",
      primary: true,
      className: "min-w-[14rem] [--cell-max:24rem]",
      render: (item) => {
        const name = localize(item.name, locale);
        const photo = (
          <ProductImage
            src={item.thumbnailUrl}
            alt={name}
            className="size-16 rounded-control md:size-14"
            sizes={ORDER_THUMB_SIZES}
          />
        );
        return (
          <div className="flex items-start gap-3" data-test-selector={testSelectorFor("order-item", item.id)}>
            {/* A removed product keeps its line (a snapshot) but has no page to open. */}
            {item.productId ? (
              <Link href={`/products/${item.productId}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
                {photo}
              </Link>
            ) : (
              <Typography variant="body" as="span" className="shrink-0">{photo}</Typography>
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              {item.productId ? (
                <Link
                  href={`/products/${item.productId}`}
                  className="self-start rounded-control text-value font-normal text-ink transition-colors hover:text-primary-700 focus-link"
                >
                  {name}
                </Link>
              ) : (
                <Typography variant="body" as="span" className="font-normal">{name}</Typography>
              )}
              {item.variantName && (
                <Typography variant="small" tone="muted" as="span" className="font-normal">{localize(item.variantName, locale)}</Typography>
              )}
              <Typography variant="small" tone="muted" as="span" className="font-normal" dir="ltr" {...SELECTABLE}>
                {item.sku ?? t("noSku")}
              </Typography>
              {/* Typed at the counter (spec.md "Quick sell"): this line's cost, and its profit, may still be missing. */}
              {item.quickSold && (
                <Typography variant="small" tone="brand" as="span" className="inline-flex items-center gap-1 font-normal">
                  <Zap className="size-3.5 shrink-0" aria-hidden="true" />
                  {t("quickSold")}
                </Typography>
              )}
              {item.returnedQuantity > 0 && (
                <Typography variant="small" as="span" className="inline-flex items-center gap-1 font-normal text-warning-700">
                  <Undo2 className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
                  {t("returned", { count: item.returnedQuantity })}
                </Typography>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "quantity",
      header: "orders.detail.items.quantityHeader",
      align: "numeric",
      render: (item) => (
        <Typography variant="body" as="span" className="tabular-nums" dir="ltr">
          {tCard("quantity", { count: item.quantity })}
        </Typography>
      ),
    },
    {
      key: "unitPrice",
      header: "orders.detail.items.unitPriceHeader",
      align: "numeric",
      render: (item) => <Typography variant="body" as="span" className="whitespace-nowrap tabular-nums">{formatMoney(item.unitPrice)}</Typography>,
    },
    {
      key: "discount",
      header: "orders.detail.items.discountHeader",
      render: renderDiscount,
    },
    {
      key: "lineTotal",
      header: "orders.detail.items.lineTotalHeader",
      align: "numeric",
      render: (item) => (
        <Typography variant="body" weight="medium" as="span" className="whitespace-nowrap tabular-nums">{formatMoney(item.lineTotal)}</Typography>
      ),
    },
  ];

  return (
    <DetailCard icon={Package} title={t("title", { count: items.length })} data-testid="order-items">
      <Table data-testid={TABLE_NAME} columns={columns} rows={items} rowKey={(item) => item.id} />
      {footer}
    </DetailCard>
  );
}
