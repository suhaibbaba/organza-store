import { useTranslations } from "next-intl";
import { MapPin, Phone, UserRound } from "lucide-react";
import { OutboundLink, PhoneLink, WhatsAppLink, Typography } from "@store/ui";
import type { Order } from "@organza/shared/types/order";
import { COORDINATE_DECIMALS } from "@/constants/orders";
import { googleMapsUrl } from "@organza/shared/lib/mapLink";
import { DetailCard } from "@/components/layout/detail-card";
import { CustomerContactRow } from "@/components/orders/detail/customer-contact-row";

export function OrderCustomerCard({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.customer");

  const hasLocation = order.customerLatitude !== null && order.customerLongitude !== null;
  const mapUrl = hasLocation ? googleMapsUrl({ latitude: Number(order.customerLatitude), longitude: Number(order.customerLongitude) }) : null;

  return (
    <DetailCard icon={UserRound} title={t("title")} className="gap-3" data-testid="order-customer-card">
      {order.customerName && <Typography variant="body">{order.customerName}</Typography>}
      {order.customerPhone && (
        <CustomerContactRow icon={Phone}>
          <PhoneLink value={order.customerPhone} data-testid="order-customer-phone" />
        </CustomerContactRow>
      )}

      {order.customerWhatsapp && (
        <CustomerContactRow>
          <WhatsAppLink value={order.customerWhatsapp} data-testid="order-customer-whatsapp" />
          <Typography variant="caption" tone="muted">{t("whatsappLabel")}</Typography>
        </CustomerContactRow>
      )}

      {order.customerAddress && (
        <CustomerContactRow icon={MapPin} multiline className="text-ink-muted">
          <Typography variant="small" as="span" className="min-w-0 whitespace-pre-line">{order.customerAddress}</Typography>
        </CustomerContactRow>
      )}

      {mapUrl && (
        <CustomerContactRow icon={MapPin}>
          <OutboundLink href={mapUrl} data-testid="order-customer-map">
            {t("openMap")}
          </OutboundLink>
          {/* The raw pair too: a driver reading it out over the phone needs the numbers. */}
          <Typography variant="caption" tone="muted" className="tabular-nums" dir="ltr">
            {order.customerLatitude?.toFixed(COORDINATE_DECIMALS)}, {order.customerLongitude?.toFixed(COORDINATE_DECIMALS)}
          </Typography>
        </CustomerContactRow>
      )}

      {order.note && (
        <div className="border-t border-line pt-3">
          <Typography variant="small" tone="muted">{t("note")}</Typography>
          <Typography variant="body" className="mt-1 whitespace-pre-line">{order.note}</Typography>
        </div>
      )}
    </DetailCard>
  );
}
