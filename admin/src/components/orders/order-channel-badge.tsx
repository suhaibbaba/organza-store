import { useTranslations } from "next-intl";
import { Globe, MessageCircle, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { OrderChannel } from "@organza/shared/types/order";
import { cn } from "@/lib/utils";

// Where the order came from (spec.md "Channel"). Icon as well as colour: at a
// glance on a phone, the shape is read before the word is.
const CHANNEL_BADGE_STYLES: Record<OrderChannel, string> = {
  STORE: "bg-secondary text-secondary-foreground",
  WHATSAPP: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  WEBSITE: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
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
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium",
        CHANNEL_BADGE_STYLES[channel],
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {t(channel)}
    </span>
  );
}
