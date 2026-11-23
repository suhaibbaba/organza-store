"use client";

import { useLocale, useTranslations } from "next-intl";
import { QuantityStepper, Typography } from "@store/ui";
import type { OrderItem } from "@store/shared/types/order";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { localize } from "@/lib/i18n-content";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { ProductImage } from "@/components/products/product-image";
import { ORDER_THUMB_SIZES } from "@/constants/orders";
import type { ReturnQuantities } from "@/types/order";

interface ExchangeReturningListProps {
  items: OrderItem[];
  quantities: ReturnQuantities;
  onChange: (itemId: string, quantity: number) => void;
}

// The pieces the customer brought back: a quantity per line, never more than they still have.
export function ExchangeReturningList({ items, quantities, onChange }: ExchangeReturningListProps) {
  const t = useTranslations("orders.exchange.returning");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  const returnable = items.filter((item) => item.quantity > item.returnedQuantity);

  return (
    <ul className="divide-y divide-line rounded-panel border border-line" data-test-selector="exchange-returning">
      {returnable.map((item) => {
        const outstanding = item.quantity - item.returnedQuantity;
        const name = localize(item.name, locale);
        const variantName = item.variantName ? localize(item.variantName, locale) : null;
        const label = variantName ? `${name} — ${variantName}` : name;

        return (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-3 p-3"
            data-test-selector={testSelectorFor("exchange-returning-line", item.id)}
          >
            <ProductImage
              src={item.thumbnailUrl}
              alt={name}
              className="size-14 shrink-0 rounded-control"
              sizes={ORDER_THUMB_SIZES}
            />
            <div className="min-w-0 flex-1 basis-40">
              <Typography variant="small" weight="medium">
                {name}
              </Typography>
              {variantName && (
                <Typography variant="caption" tone="muted" as="p" className="truncate">
                  {variantName}
                </Typography>
              )}
              <Typography variant="caption" tone="muted" as="p">
                {t("soldAt", { price: formatMoney(item.unitPrice), count: outstanding })}
              </Typography>
            </div>
            <QuantityStepper
              value={quantities[item.id] ?? 0}
              // 0 = this line stays with the customer.
              min={0}
              max={outstanding}
              onChange={(quantity) => onChange(item.id, quantity)}
              decreaseLabel={t("decrease", { name: label })}
              increaseLabel={t("increase", { name: label })}
              valueLabel={t("quantityFor", { name: label })}
              className="shrink-0"
            />
          </li>
        );
      })}
    </ul>
  );
}
