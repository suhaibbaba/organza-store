import { useTranslations } from "next-intl";
import type { Order } from "@organza/shared/types/order";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Card } from "@store/ui";

// Same order of operations as backend/src/lib/orderPricing.ts: subtotal, order discount, total.
export function OrderTotalsCard({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.totals");
  const tDiscount = useTranslations("orders.discount");
  const tPayment = useTranslations("orders.payment");
  const formatMoney = useMoneyFormatter();

  const hasOrderDiscount = order.discountType !== null && Number(order.discountAmount) > 0;

  return (
    <Card className="flex flex-col gap-2 text-label">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-muted">{t("subtotal")}</span>
          <span className="tabular-nums text-ink">{formatMoney(order.subtotal)}</span>
        </div>

        {hasOrderDiscount && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">
              {t("orderDiscount", {
                label:
                  order.discountType === "PERCENT"
                    ? tDiscount("percentValue", { value: Number(order.discountValue ?? 0) })
                    : formatMoney(order.discountValue ?? "0"),
              })}
            </span>
            <span className="tabular-nums text-success-700">
              −{formatMoney(order.discountAmount)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-line pt-2">
          <span className="font-semibold text-ink">{t("total")}</span>
          <span className="text-heading font-bold tabular-nums text-ink">{formatMoney(order.total)}</span>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-2">
          <span className="text-ink-muted">{t("paymentMethod")}</span>
          <span className="text-ink">{tPayment(order.paymentMethod)}</span>
        </div>
    </Card>
  );
}
