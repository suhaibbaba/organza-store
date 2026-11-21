import { useTranslations } from "next-intl";
import { Gift } from "lucide-react";
import { GIFT_ORDER_TYPE } from "@organza/shared/constants/order";
import type { OrderType } from "@organza/shared/types/order";
import { cn } from "@/lib/utils";

// Only a gift is badged (spec.md "Gifts"): it explains a 0.00 total that is not a mistake.
export function OrderTypeBadge({ type, className }: { type: OrderType; className?: string }) {
  const t = useTranslations("orders.type");

  if (type !== GIFT_ORDER_TYPE) return null;

  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-pill bg-tint-5-bg px-2.5 text-micro font-medium text-tint-5-ink",
        className
      )}
    >
      <Gift className="size-3.5" aria-hidden="true" />
      {t(GIFT_ORDER_TYPE)}
    </span>
  );
}
