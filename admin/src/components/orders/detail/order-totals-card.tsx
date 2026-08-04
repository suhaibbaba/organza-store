import { useTranslations } from "next-intl";
import type { Order } from "@shared/types/order";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Card, CardContent } from "@/components/ui/card";

// The money, in the order it was worked out: line totals summed into a
// subtotal (item discounts already applied), then the order-level discount,
// then what was actually charged — the same order of operations the backend
// used (backend/src/lib/orderPricing.ts).
export function OrderTotalsCard({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.totals");
  const tDiscount = useTranslations("orders.discount");
  const tPayment = useTranslations("orders.payment");
  const formatMoney = useMoneyFormatter();

  const hasOrderDiscount = order.discountType !== null && Number(order.discountAmount) > 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{t("subtotal")}</span>
          <span className="tabular-nums text-foreground">{formatMoney(order.subtotal)}</span>
        </div>

        {hasOrderDiscount && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">
              {t("orderDiscount", {
                label:
                  order.discountType === "PERCENT"
                    ? tDiscount("percentValue", { value: Number(order.discountValue ?? 0) })
                    : formatMoney(order.discountValue ?? "0"),
              })}
            </span>
            <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
              −{formatMoney(order.discountAmount)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
          <span className="font-semibold text-foreground">{t("total")}</span>
          <span className="text-lg font-bold tabular-nums text-foreground">{formatMoney(order.total)}</span>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
          <span className="text-muted-foreground">{t("paymentMethod")}</span>
          <span className="text-foreground">{tPayment(order.paymentMethod)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
