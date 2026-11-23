"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge, CardButton, Typography } from "@store/ui";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import type { OrderSummary } from "@store/shared/types/order";
import { ProductThumb } from "@/components/sell/product-thumb";
import { SELL_CART_THUMB_SIZES } from "@/constants/images";
import { EXCHANGE_ROW_PREVIEW_ITEMS } from "@/constants/exchange";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { isExchangeable } from "@/lib/exchange";
import { formatDateTime } from "@/lib/format";
import { localize } from "@/lib/i18n-content";

interface ExchangeSaleRowProps {
  order: OrderSummary;
  onSelect: () => void;
}

// One past sale: its number, when, who, what was in it and what it came to; one the backend would refuse is drawn but not tappable.
export function ExchangeSaleRow({ order, onSelect }: ExchangeSaleRowProps) {
  const t = useTranslations("sell.exchange");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const allowed = isExchangeable(order);
  const shown = order.previewItems.slice(0, EXCHANGE_ROW_PREVIEW_ITEMS);
  const more = order.itemCount - shown.length;
  const names = shown.map((item) => localize(item.name, locale)).join(t("itemSeparator"));

  return (
    <CardButton
      onClick={onSelect}
      disabled={!allowed}
      data-testid={testSelectorFor("pos-exchange-sale", order.id)}
      className="items-center gap-3 px-3 py-3 focus-darken disabled:opacity-60"
    >
      <span className="flex shrink-0 -space-x-3 rtl:space-x-reverse">
        {shown.map((item) => (
          <ProductThumb
            key={item.id}
            src={item.thumbnailUrl}
            alt=""
            sizes={SELL_CART_THUMB_SIZES}
            className="size-12 rounded-photo border-2 border-surface"
          />
        ))}
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <Typography as="span" variant="body" weight="semibold" className="tabular-nums">
            {t("orderNumber", { number: order.orderNumber })}
          </Typography>
          {!allowed && <Badge tone="neutral">{t("notExchangeable")}</Badge>}
        </span>
        <Typography as="span" variant="small" className="w-full truncate text-start">
          {more > 0 ? t("itemsMore", { names, count: more }) : names}
        </Typography>
        <Typography as="span" variant="caption" tone="muted" className="w-full truncate text-start">
          {order.customerName
            ? t("whenWho", { when: formatDateTime(order.createdAt, locale), name: order.customerName })
            : formatDateTime(order.createdAt, locale)}
        </Typography>
      </span>
      <Typography as="span" variant="body" weight="bold" className="shrink-0 tabular-nums">
        {formatMoney(order.total)}
      </Typography>
    </CardButton>
  );
}
