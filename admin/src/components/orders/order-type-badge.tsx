import { useTranslations } from "next-intl";
import { Badge } from "@store/ui";
import { GIFT_ORDER_TYPE } from "@organza/shared/constants/order";
import type { OrderType } from "@organza/shared/types/order";
import { cn } from "@/lib/utils";

// Only a gift is badged (spec.md "Gifts"): it explains a 0.00 total that is not a mistake.
export function OrderTypeBadge({ type, className }: { type: OrderType; className?: string }) {
  const t = useTranslations("orders.type");

  if (type !== GIFT_ORDER_TYPE) return null;

  return (
    <Badge tone="violet" icon="gift" className={cn("shrink-0", className)} data-testid="order-gift-badge">
      {t(GIFT_ORDER_TYPE)}
    </Badge>
  );
}
