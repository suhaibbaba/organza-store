import { useTranslations } from "next-intl";
import { Globe, MessageCircle, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { OrderChannel } from "@organza/shared/types/order";
import { cn } from "@/lib/utils";

const CHANNEL_BADGE_STYLES: Record<OrderChannel, string> = {
  STORE: "bg-sunken text-ink-muted",
  WHATSAPP: "bg-success-100 text-success-900",
  WEBSITE: "bg-tint-3-bg text-tint-3-ink",
};

const CHANNEL_ICONS: Record<OrderChannel, LucideIcon> = {
  STORE: Store,
  WHATSAPP: MessageCircle,
  WEBSITE: Globe,
};

export function OrderChannelBadge({ channel, className }: { channel: OrderChannel; className?: string }) {
  const t = useTranslations("orders.channel");
  const Icon = CHANNEL_ICONS[channel];

  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-pill px-2.5 text-micro font-medium",
        CHANNEL_BADGE_STYLES[channel],
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {t(channel)}
    </span>
  );
}
