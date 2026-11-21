import { useTranslations } from "next-intl";
import { Badge, type BadgeTone, type IconName } from "@store/ui";
import type { OrderStatus } from "@organza/shared/types/order";
import { cn } from "@/lib/utils";

// Same meaning on every screen: info = to do, warning = in motion, success = done, danger = money that didn't happen, neutral = reversed.
const STATUS_BADGE_TONES: Record<OrderStatus, BadgeTone> = {
  NEW: "info",
  PREPARING: "warning",
  HANDED_TO_COURIER: "success",
  COMPLETED: "success",
  CANCELLED: "danger",
  RETURNED: "neutral",
};

const STATUS_BADGE_ICONS: Record<OrderStatus, IconName> = {
  NEW: "bell",
  PREPARING: "package",
  HANDED_TO_COURIER: "send",
  COMPLETED: "check",
  CANCELLED: "x",
  RETURNED: "reset",
};

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const t = useTranslations("orders.status");

  return (
    <Badge tone={STATUS_BADGE_TONES[status]} icon={STATUS_BADGE_ICONS[status]} className={cn("shrink-0", className)}>
      {t(status)}
    </Badge>
  );
}
