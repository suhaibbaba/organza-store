import { Typography } from "@store/ui";
import { useLocale, useTranslations } from "next-intl";
import { Info } from "lucide-react";
import type { Order } from "@store/shared/types/order";
import { formatDateTime } from "@/lib/format";
import { DetailCard } from "@/components/layout/detail-card";

// "Has this left the shelf yet?" is what staff ask, and the status alone doesn't say.
export function OrderMetaCard({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.meta");
  const locale = useLocale();

  const rows = [
    { key: "updatedAt", label: t("updatedAt"), value: formatDateTime(order.updatedAt, locale) },
    {
      key: "stockDeductedAt",
      label: t("stockDeducted"),
      value: order.stockDeductedAt ? formatDateTime(order.stockDeductedAt, locale) : t("stockNotDeducted"),
    },
  ];

  return (
    <DetailCard icon={Info} title={t("title")} data-testid="order-meta">
      <dl className="flex flex-col divide-y divide-line">
        {rows.map((row) => (
          <div key={row.key} className="py-3 first:pt-0 last:pb-0">
            <Typography variant="body" tone="muted" as="dt">
              {row.label}
            </Typography>
            <Typography variant="body" as="dd" className="mt-0.5 tabular-nums">
              {row.value}
            </Typography>
          </div>
        ))}
      </dl>
    </DetailCard>
  );
}
