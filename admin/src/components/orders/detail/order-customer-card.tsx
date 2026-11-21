import { useTranslations } from "next-intl";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import { Card } from "@store/ui";
import type { Order } from "@organza/shared/types/order";
import { SELECTABLE } from "@organza/shared/lib/nativeGestures";
import { COORDINATE_DECIMALS, MAP_LINK_TEMPLATE } from "@/constants/orders";

// The order's customer snapshot (no Customer entity yet); numbers shown exactly as stored, prefix included (rule 18).
export function OrderCustomerCard({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.customer");

  const hasLocation = order.customerLatitude !== null && order.customerLongitude !== null;
  const mapUrl = hasLocation ? `${MAP_LINK_TEMPLATE}${order.customerLatitude},${order.customerLongitude}` : null;

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-section font-medium text-ink">{t("title")}</h2>

      {order.customerName && <p className="text-label font-medium text-ink">{order.customerName}</p>}

      {order.customerPhone && (
        <a
          href={`tel:${order.customerPhone}`}
          className="flex min-h-11 items-center gap-2 text-label text-primary-600 hover:underline"
        >
          <Phone className="size-4 shrink-0" aria-hidden="true" />
          <span dir="ltr" {...SELECTABLE}>
            {order.customerPhone}
          </span>
        </a>
      )}

      {order.customerWhatsapp && (
        <a
          href={`tel:${order.customerWhatsapp}`}
          className="flex min-h-11 items-center gap-2 text-label text-primary-600 hover:underline"
        >
          <MessageCircle className="size-4 shrink-0" aria-hidden="true" />
          <span dir="ltr" {...SELECTABLE}>
            {order.customerWhatsapp}
          </span>
          <span className="text-micro text-ink-muted">{t("whatsappLabel")}</span>
        </a>
      )}

      {order.customerAddress && (
        <p className="flex items-start gap-2 text-label text-ink-muted">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 whitespace-pre-line" {...SELECTABLE}>
            {order.customerAddress}
          </span>
        </p>
      )}

      {mapUrl && (
        <a
          href={mapUrl}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center gap-2 text-label text-primary-600 hover:underline"
        >
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          {t("openMap")}
          {/* The raw pair too: a driver reading it out over the phone needs the numbers. */}
          <span className="text-micro tabular-nums text-ink-muted" dir="ltr" {...SELECTABLE}>
            {order.customerLatitude?.toFixed(COORDINATE_DECIMALS)}, {order.customerLongitude?.toFixed(COORDINATE_DECIMALS)}
          </span>
        </a>
      )}

      {order.note && (
        <div className="border-t border-line pt-3">
          <p className="text-micro text-ink-muted">{t("note")}</p>
          <p className="mt-1 whitespace-pre-line text-label text-ink">{order.note}</p>
        </div>
      )}
    </Card>
  );
}
