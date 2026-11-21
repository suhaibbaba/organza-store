import { useTranslations } from "next-intl";
import type { Order } from "@organza/shared/types/order";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";

// Same order of operations as backend/src/lib/orderPricing.ts: subtotal, order discount, total.
export function OrderTotals({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.totals");
  const tDiscount = useTranslations("orders.discount");
  const formatMoney = useMoneyFormatter();

  const hasOrderDiscount = order.discountType !== null && Number(order.discountAmount) > 0;

  return (
    <div className="flex flex-col gap-1 overflow-hidden rounded-panel border border-line text-value" data-test-selector="order-totals">
      <div className="flex items-center justify-between gap-3 px-5 pt-3">
        <span className="text-ink-muted">{t("subtotal")}</span>
        <span className="tabular-nums text-ink">{formatMoney(order.subtotal)}</span>
      </div>

      {hasOrderDiscount && (
        <div className="flex items-center justify-between gap-3 px-5">
          <span className="text-ink-muted">
            {t("orderDiscount", {
              label:
                order.discountType === "PERCENT"
                  ? tDiscount("percentValue", { value: Number(order.discountValue ?? 0) })
                  : formatMoney(order.discountValue ?? "0"),
            })}
          </span>
          <span className="tabular-nums text-success-700" dir="ltr">
            −{formatMoney(order.discountAmount)}
          </span>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-3 bg-primary-50 px-5 py-3">
        <span className="font-semibold text-primary-900">{t("total")}</span>
        <span className="text-heading font-semibold tabular-nums text-primary-900">{formatMoney(order.total)}</span>
      </div>
    </div>
  );
}
