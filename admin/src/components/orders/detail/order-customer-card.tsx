import { useTranslations } from "next-intl";
import { MapPin, Phone, UserRound } from "lucide-react";
import { PhoneLink, WhatsAppLink } from "@store/ui";
import type { Order } from "@organza/shared/types/order";
import { SELECTABLE } from "@organza/shared/lib/nativeGestures";
import { COORDINATE_DECIMALS, MAP_LINK_TEMPLATE } from "@/constants/orders";
import { DetailCard } from "@/components/layout/detail-card";

// The order's customer snapshot (no Customer entity yet); numbers shown exactly as stored, prefix included (rule 18).
export function OrderCustomerCard({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.customer");

  const hasLocation = order.customerLatitude !== null && order.customerLongitude !== null;
  const mapUrl = hasLocation ? `${MAP_LINK_TEMPLATE}${order.customerLatitude},${order.customerLongitude}` : null;

  return (
    <DetailCard icon={UserRound} title={t("title")} className="gap-3" data-testid="order-customer-card">
      {order.customerName && <p className="text-value text-ink">{order.customerName}</p>}
      {order.customerPhone && (
        <p className="flex min-h-11 items-center gap-2 text-label" {...SELECTABLE}>
          <Phone className="size-4 shrink-0 text-primary-600" aria-hidden="true" />
          <PhoneLink value={order.customerPhone} data-testid="order-customer-phone" />
        </p>
      )}

      {order.customerWhatsapp && (
        <p className="flex min-h-11 items-center gap-2 text-label" {...SELECTABLE}>
          <WhatsAppLink value={order.customerWhatsapp} data-testid="order-customer-whatsapp" />
          <span className="text-micro text-ink-muted">{t("whatsappLabel")}</span>
        </p>
      )}

      {order.customerAddress && (
        <p className="flex items-start gap-2 text-label text-ink-muted">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary-700" aria-hidden="true" />
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
          className="flex min-h-11 items-center gap-2 text-label text-primary-600 transition-colors hover:text-primary-700 focus-link"
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
          <p className="text-label text-ink-muted">{t("note")}</p>
          <p className="mt-1 whitespace-pre-line text-value text-ink">{order.note}</p>
        </div>
      )}
    </DetailCard>
  );
}
