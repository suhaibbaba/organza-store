import { useTranslations } from "next-intl";
import { Badge, type BadgeVariant, type IconName } from "@store/ui";
import type { OrderChannel } from "@organza/shared/types/order";
import { cn } from "@/lib/utils";

const CHANNEL_BADGE_TONES: Record<OrderChannel, BadgeVariant> = {
  STORE: "neutral",
  WHATSAPP: "success",
  WEBSITE: "info",
};

const CHANNEL_ICONS: Record<OrderChannel, IconName> = {
  STORE: "store",
  WHATSAPP: "whatsapp",
  WEBSITE: "globe",
};

export function OrderChannelBadge({ channel, className }: { channel: OrderChannel; className?: string }) {
  const t = useTranslations("orders.channel");

  return (
    <Badge tone={CHANNEL_BADGE_TONES[channel]} icon={CHANNEL_ICONS[channel]} className={cn("shrink-0", className)}>
      {t(channel)}
    </Badge>
  );
}
