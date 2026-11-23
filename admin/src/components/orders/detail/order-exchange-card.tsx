"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowLeftRight } from "lucide-react";
import { Typography } from "@store/ui";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import type { Order, OrderExchangeLink } from "@store/shared/types/order";
import { Link } from "@/i18n/navigation";
import { DetailCard } from "@/components/layout/detail-card";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { formatDateTime } from "@/lib/format";

// Either side of an exchange links to the other: the sale the pieces came from, or the exchanges made from it.
export function OrderExchangeCard({ order }: { order: Order }) {
  const t = useTranslations("orders.exchange.detail");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  if (!order.exchangeOf && order.exchanges.length === 0) {
    return null;
  }

  function orderLink(link: OrderExchangeLink, labelKey: "of" | "to") {
    return (
      <Link
        href={`/orders/${link.id}`}
        className="self-start rounded-control text-value text-primary-700 transition-colors hover:text-primary-900 focus-link"
        data-test-selector={testSelectorFor("order-exchange-link", link.id)}
      >
        {t(labelKey, { number: String(link.orderNumber) })}
      </Link>
    );
  }

  return (
    <DetailCard icon={ArrowLeftRight} title={t("title")} data-testid="order-exchange">
      <div className="flex flex-col gap-3">
        {order.exchangeOf && (
          <div className="flex flex-col gap-1">
            {orderLink(order.exchangeOf, "of")}
            <Typography variant="small" tone="muted">
              {t("credit", { amount: formatMoney(order.exchangeCredit) })}
            </Typography>
            {order.exchangeSettlement && (
              <Typography variant="small" data-test-selector="order-exchange-settlement">
                {t(`settlement.${order.exchangeSettlement}`)}
              </Typography>
            )}
          </div>
        )}
        {order.exchanges.length > 0 && (
          <ul className="flex flex-col gap-2">
            {order.exchanges.map((link) => (
              <li key={link.id} className="flex flex-col gap-0.5">
                {orderLink(link, "to")}
                <Typography variant="small" tone="muted">
                  {formatDateTime(link.createdAt, locale)}
                </Typography>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DetailCard>
  );
}
