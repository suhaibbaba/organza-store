import { useLocale, useTranslations } from "next-intl";
import { Undo2 } from "lucide-react";
import type { OrderItem } from "@shared/types/order";
import { localize } from "@/lib/i18n-content";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// What was sold, one card-row per line. A line shows the four things needed
// to check an order against a chat message: what it is, how many, what each
// one cost, and what the line came to after its own discount.
export function OrderItemsList({ items }: { items: OrderItem[] }) {
  const t = useTranslations("orders.detail.items");
  const tDiscount = useTranslations("orders.discount");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("title", { count: items.length })}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.map((item) => {
          const name = localize(item.name, locale);
          const variantName = item.variantName ? localize(item.variantName, locale) : null;
          const hasDiscount = item.discountType !== null && Number(item.discountAmount) > 0;

          return (
            <div key={item.id} className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{name}</p>
                  {variantName && <p className="truncate text-xs text-muted-foreground">{variantName}</p>}
                  {/* SKU is Latin text (ORG-00042) — pinned LTR so it reads
                      correctly inside an RTL page. */}
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">
                    {item.sku ?? t("noSku")}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatMoney(item.lineTotal)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-1.5 text-xs text-muted-foreground">
                <span>{t("quantity", { count: item.quantity })}</span>
                <span aria-hidden="true">·</span>
                <span>{t("unitPrice", { price: formatMoney(item.unitPrice) })}</span>
                {hasDiscount && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {t("itemDiscount", {
                        // The stored (type, value) pair is shown as well as
                        // the resolved amount, so "10%" doesn't have to be
                        // reverse-engineered from the money it took off.
                        label:
                          item.discountType === "PERCENT"
                            ? tDiscount("percentValue", { value: Number(item.discountValue ?? 0) })
                            : formatMoney(item.discountValue ?? "0"),
                        amount: formatMoney(item.discountAmount),
                      })}
                    </span>
                  </>
                )}
              </div>

              {item.returnedQuantity > 0 && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <Undo2 className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
                  {t("returned", { count: item.returnedQuantity })}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
