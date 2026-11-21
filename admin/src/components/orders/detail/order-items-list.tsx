import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Package, Undo2, Zap } from "lucide-react";
import { Table, type Column } from "@store/ui";
import type { OrderItem } from "@organza/shared/types/order";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { SELECTABLE } from "@organza/shared/lib/nativeGestures";
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
        <span className="tabular-nums text-success-700" dir="ltr">
          −{formatMoney(item.discountAmount)}
        </span>
        {item.discountType === "PERCENT" && (
          <span className="text-label text-ink-muted">
            {tDiscount("percentValue", { value: Number(item.discountValue ?? 0) })}
          </span>
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
              <span className="shrink-0">{photo}</span>
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              {item.productId ? (
                <Link
                  href={`/products/${item.productId}`}
                  className="self-start rounded-control text-value font-normal text-ink transition-colors hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  {name}
                </Link>
              ) : (
                <span className="text-value font-normal text-ink">{name}</span>
              )}
              {item.variantName && (
                <span className="text-label font-normal text-ink-muted">{localize(item.variantName, locale)}</span>
              )}
              <span className="text-label font-normal text-ink-muted" dir="ltr" {...SELECTABLE}>
                {item.sku ?? t("noSku")}
              </span>
              {/* Typed at the counter (spec.md "Quick sell"): this line's cost, and its profit, may still be missing. */}
              {item.quickSold && (
                <span className="inline-flex items-center gap-1 text-label font-normal text-primary-600">
                  <Zap className="size-3.5 shrink-0" aria-hidden="true" />
                  {t("quickSold")}
                </span>
              )}
              {item.returnedQuantity > 0 && (
                <span className="inline-flex items-center gap-1 text-label font-normal text-warning-700">
                  <Undo2 className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
                  {t("returned", { count: item.returnedQuantity })}
                </span>
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
        <span className="tabular-nums" dir="ltr">
          {tCard("quantity", { count: item.quantity })}
        </span>
      ),
    },
    {
      key: "unitPrice",
      header: "orders.detail.items.unitPriceHeader",
      align: "numeric",
      render: (item) => <span className="whitespace-nowrap tabular-nums">{formatMoney(item.unitPrice)}</span>,
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
        <span className="whitespace-nowrap font-medium tabular-nums text-ink">{formatMoney(item.lineTotal)}</span>
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
