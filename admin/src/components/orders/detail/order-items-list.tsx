import { useLocale, useTranslations } from "next-intl";
import { Undo2, Zap } from "lucide-react";
import { Card } from "@store/ui";
import type { OrderItem } from "@organza/shared/types/order";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { localize } from "@/lib/i18n-content";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";

// One tile per sold line: what it is, how many, unit price and line total after its own discount.
export function OrderItemsList({ items }: { items: OrderItem[] }) {
  const t = useTranslations("orders.detail.items");
  const tDiscount = useTranslations("orders.discount");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-section font-medium text-ink">{t("title", { count: items.length })}</h2>
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const name = localize(item.name, locale);
          const variantName = item.variantName ? localize(item.variantName, locale) : null;
          const hasDiscount = item.discountType !== null && Number(item.discountAmount) > 0;

          return (
            <div
              key={item.id}
              className="flex flex-col gap-1.5 rounded-panel border border-line p-3"
              data-test-selector={testSelectorFor("order-item", item.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-label font-medium text-ink">{name}</p>
                  {/* Typed at the counter (spec.md "Quick sell"): this line's cost, and its profit, may still be missing. */}
                  {item.quickSold && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-micro font-medium text-primary-600">
                      <Zap className="size-3.5 shrink-0" aria-hidden="true" />
                      {t("quickSold")}
                    </p>
                  )}
                  {variantName && <p className="truncate text-micro text-ink-muted">{variantName}</p>}
                  <p className="truncate text-micro text-ink-muted" dir="ltr">
                    {item.sku ?? t("noSku")}
                  </p>
                </div>
                <span className="shrink-0 text-label font-semibold tabular-nums text-ink">
                  {formatMoney(item.lineTotal)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-1.5 text-micro text-ink-muted">
                <span>{t("quantity", { count: item.quantity })}</span>
                <span aria-hidden="true">·</span>
                <span>{t("unitPrice", { price: formatMoney(item.unitPrice) })}</span>
                {hasDiscount && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-success-700">
                      {t("itemDiscount", {
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
                <p className="flex items-center gap-1.5 text-micro font-medium text-warning-700">
                  <Undo2 className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
                  {t("returned", { count: item.returnedQuantity })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
