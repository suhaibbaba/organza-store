import { useLocale, useTranslations } from "next-intl";
import type { Order } from "@organza/shared/types/order";
import { formatDateTime } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";

// Who took the order and when things happened to it. `stockDeductedAt` is
// shown as its own line because it answers the question staff actually ask —
// "has this been taken off the shelf yet?" — which the status alone doesn't.
export function OrderMetaCard({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.meta");
  const locale = useLocale();

  const rows: { key: string; label: string; value: string }[] = [
    { key: "createdBy", label: t("createdBy"), value: order.createdBy?.name ?? t("unknownStaff") },
    { key: "createdAt", label: t("createdAt"), value: formatDateTime(order.createdAt, locale) },
    { key: "updatedAt", label: t("updatedAt"), value: formatDateTime(order.updatedAt, locale) },
    {
      key: "stockDeductedAt",
      label: t("stockDeducted"),
      value: order.stockDeductedAt ? formatDateTime(order.stockDeductedAt, locale) : t("stockNotDeducted"),
    },
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-5 text-sm">
        {rows.map((row) => (
          <div key={row.key} className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-muted-foreground">{row.label}</span>
            <span className="text-end text-foreground">{row.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
