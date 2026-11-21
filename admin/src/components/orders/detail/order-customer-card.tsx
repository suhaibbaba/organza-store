import { useTranslations } from "next-intl";
import { MapPin, Phone, UserRound } from "lucide-react";
import { PhoneLink, WhatsAppLink } from "@store/ui";
import type { Order } from "@organza/shared/types/order";
import { COORDINATE_DECIMALS, MAP_LINK_TEMPLATE } from "@/constants/orders";
import { DetailCard } from "@/components/layout/detail-card";
import { CustomerContactRow } from "@/components/orders/detail/customer-contact-row";

export function OrderCustomerCard({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.customer");

  const hasLocation = order.customerLatitude !== null && order.customerLongitude !== null;
  const mapUrl = hasLocation ? `${MAP_LINK_TEMPLATE}${order.customerLatitude},${order.customerLongitude}` : null;

  return (
    <DetailCard icon={UserRound} title={t("title")} className="gap-3" data-testid="order-customer-card">
      {order.customerName && <p className="text-value text-ink">{order.customerName}</p>}
      {order.customerPhone && (
        <CustomerContactRow icon={Phone}>
          <PhoneLink value={order.customerPhone} data-testid="order-customer-phone" />
        </CustomerContactRow>
      )}

      {order.customerWhatsapp && (
        <CustomerContactRow>
          <WhatsAppLink value={order.customerWhatsapp} data-testid="order-customer-whatsapp" />
          <span className="text-micro text-ink-muted">{t("whatsappLabel")}</span>
        </CustomerContactRow>
      )}

      {order.customerAddress && (
        <CustomerContactRow icon={MapPin} multiline className="text-ink-muted">
          <span className="min-w-0 whitespace-pre-line">{order.customerAddress}</span>
        </CustomerContactRow>
      )}

      {mapUrl && (
        <CustomerContactRow icon={MapPin}>
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary-600 transition-colors hover:text-primary-700 focus-link"
          >
            {t("openMap")}
          </a>
          {/* The raw pair too: a driver reading it out over the phone needs the numbers. */}
          <span className="text-micro tabular-nums text-ink-muted" dir="ltr">
            {order.customerLatitude?.toFixed(COORDINATE_DECIMALS)}, {order.customerLongitude?.toFixed(COORDINATE_DECIMALS)}
          </span>
        </CustomerContactRow>
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
