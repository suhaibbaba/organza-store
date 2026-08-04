import { useTranslations } from "next-intl";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import type { Order } from "@shared/types/order";
import { COORDINATE_DECIMALS, MAP_LINK_TEMPLATE } from "@/constants/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// The customer snapshot taken when the order was placed (spec.md "Customer
// information") — there is no Customer entity yet, so this is the only record
// of who it goes to.
//
// The phone and WhatsApp numbers are live links: on a phone, "call this
// customer" should be one tap, not a copy-paste. Numbers are shown exactly as
// stored, prefix included (CLAUDE.md rule 18) — never rewritten.
export function OrderCustomerCard({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.customer");

  const hasLocation = order.customerLatitude !== null && order.customerLongitude !== null;
  const mapUrl = hasLocation ? `${MAP_LINK_TEMPLATE}${order.customerLatitude},${order.customerLongitude}` : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {order.customerName && <p className="text-sm font-medium text-foreground">{order.customerName}</p>}

        {order.customerPhone && (
          <a
            href={`tel:${order.customerPhone}`}
            className="flex min-h-11 items-center gap-2 text-sm text-primary hover:underline"
          >
            <Phone className="size-4 shrink-0" aria-hidden="true" />
            <span dir="ltr">{order.customerPhone}</span>
          </a>
        )}

        {order.customerWhatsapp && (
          <a
            href={`tel:${order.customerWhatsapp}`}
            className="flex min-h-11 items-center gap-2 text-sm text-primary hover:underline"
          >
            <MessageCircle className="size-4 shrink-0" aria-hidden="true" />
            <span dir="ltr">{order.customerWhatsapp}</span>
            <span className="text-xs text-muted-foreground">{t("whatsappLabel")}</span>
          </a>
        )}

        {order.customerAddress && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 whitespace-pre-line">{order.customerAddress}</span>
          </p>
        )}

        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-2 text-sm text-primary hover:underline"
          >
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {t("openMap")}
            {/* The raw pair is shown too — a driver reading it out over the
                phone needs the numbers, not just a link. */}
            <span className="text-xs tabular-nums text-muted-foreground" dir="ltr">
              {order.customerLatitude?.toFixed(COORDINATE_DECIMALS)}, {order.customerLongitude?.toFixed(COORDINATE_DECIMALS)}
            </span>
          </a>
        )}

        {order.note && (
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">{t("note")}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-foreground">{order.note}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
