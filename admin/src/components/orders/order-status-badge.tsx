import { useTranslations } from "next-intl";
import type { OrderStatus } from "@shared/types/order";
import { cn } from "@/lib/utils";

// Colour carries the same meaning on every screen: teal = still to do,
// amber/blue = in motion, green = finished, red = money that didn't happen,
// grey = reversed.
const STATUS_BADGE_STYLES: Record<OrderStatus, string> = {
  NEW: "bg-primary/10 text-primary",
  PREPARING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  DELIVERING: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  RECEIVED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  COMPLETED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  CANCELLED: "bg-destructive/10 text-destructive",
  RETURNED: "bg-muted text-muted-foreground",
};

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const t = useTranslations("orders.status");

  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium",
        STATUS_BADGE_STYLES[status],
        className
      )}
    >
      {t(status)}
    </span>
  );
}
