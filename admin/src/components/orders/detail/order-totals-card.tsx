import { Typography } from "@store/ui";
import { useTranslations } from "next-intl";
import type { Order } from "@store/shared/types/order";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";

// Same order of operations as backend/src/lib/orderPricing.ts: subtotal, order discount, total.
export function OrderTotals({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.totals");
  const tDiscount = useTranslations("orders.discount");
  const formatMoney = useMoneyFormatter();

  const hasOrderDiscount = order.discountType !== null && Number(order.discountAmount) > 0;

  return (
    <div
      className="flex flex-col gap-1 overflow-hidden rounded-panel border border-line text-value"
      data-test-selector="order-totals"
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-3">
        <Typography variant="body" tone="muted" as="span">
          {t("subtotal")}
        </Typography>
        <Typography variant="body" as="span" className="tabular-nums">
          {formatMoney(order.subtotal)}
        </Typography>
      </div>

      {hasOrderDiscount && (
        <div className="flex items-center justify-between gap-3 px-5">
          <Typography variant="body" tone="muted" as="span">
            {t("orderDiscount", {
              label:
                order.discountType === "PERCENT"
                  ? tDiscount("percentValue", { value: Number(order.discountValue ?? 0) })
                  : formatMoney(order.discountValue ?? "0"),
            })}
          </Typography>
          <Typography variant="body" tone="success" as="span" className="tabular-nums" dir="ltr">
            −{formatMoney(order.discountAmount)}
          </Typography>
        </div>
      )}

      {Number(order.exchangeKept) > 0 && (
        <div className="flex items-center justify-between gap-3 px-5" data-test-selector="order-exchange-kept">
          <Typography variant="body" tone="muted" as="span">
            {t("exchangeKept")}
          </Typography>
          <Typography variant="body" as="span" className="tabular-nums" dir="ltr">
            +{formatMoney(order.exchangeKept)}
          </Typography>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-3 bg-primary-50 px-5 py-3">
        <Typography variant="body" weight="semibold" as="span">
          {t("total")}
        </Typography>
        <Typography variant="h2" weight="semibold" as="span" className="tabular-nums text-primary-900">
          {formatMoney(order.total)}
        </Typography>
      </div>

      {order.exchangeOf && Number(order.exchangeCredit) > 0 && (
        <div className="flex items-center justify-between gap-3 px-5 pb-3" data-test-selector="order-exchange-credit">
          <Typography variant="body" tone="muted" as="span">
            {t("exchangeCredit")}
          </Typography>
          <Typography variant="body" tone="success" as="span" className="tabular-nums" dir="ltr">
            −{formatMoney(order.exchangeCredit)}
          </Typography>
        </div>
      )}
    </div>
  );
}
