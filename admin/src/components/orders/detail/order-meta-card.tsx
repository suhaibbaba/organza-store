import { useLocale, useTranslations } from "next-intl";
import type { Order } from "@organza/shared/types/order";
import { formatDateTime } from "@/lib/format";
import { useActorName } from "@/lib/user-display";
import { Card } from "@store/ui";

// `stockDeductedAt` gets its own line: "has this left the shelf yet?" is what staff ask, and the status alone doesn't say.
export function OrderMetaCard({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.meta");
  const locale = useLocale();
  const actorName = useActorName();

  const rows: { key: string; label: string; value: string }[] = [
    { key: "createdBy", label: t("createdBy"), value: actorName(order.createdBy, t("unknownStaff")) },
    { key: "createdAt", label: t("createdAt"), value: formatDateTime(order.createdAt, locale) },
    { key: "updatedAt", label: t("updatedAt"), value: formatDateTime(order.updatedAt, locale) },
    {
      key: "stockDeductedAt",
      label: t("stockDeducted"),
      value: order.stockDeductedAt ? formatDateTime(order.stockDeductedAt, locale) : t("stockNotDeducted"),
    },
  ];

  return (
    <Card className="flex flex-col gap-2 text-label">
        {rows.map((row) => (
          <div key={row.key} className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-ink-muted">{row.label}</span>
            <span className="text-end text-ink">{row.value}</span>
          </div>
        ))}
    </Card>
  );
}
