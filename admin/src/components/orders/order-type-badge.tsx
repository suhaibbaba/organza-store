import { useTranslations } from "next-intl";
import { Gift } from "lucide-react";
import { GIFT_ORDER_TYPE } from "@shared/constants/order";
import type { OrderType } from "@shared/types/order";
import { cn } from "@/lib/utils";

// What the order IS, as opposed to where it came from (spec.md "Gifts"): a
// SALE is money in, a GIFT is stock that walked out for nothing.
//
// Only a gift is badged. Almost every row in this list is a sale, so a badge
// saying so would be on every row and read as decoration — and the row's own
// total already says a sale took money. What has to stand out is the order
// that took none, so the badge appears exactly where the figures need
// explaining: a 0.00 total that is not a mistake.
//
// The violet is the POS's gift colour (globals.css), so the badge here is the
// colour of the button that created the order. Icon as well as colour, and
// the word as well as the icon — the same rule the channel badge follows.
export function OrderTypeBadge({ type, className }: { type: OrderType; className?: string }) {
  const t = useTranslations("orders.type");

  if (type !== GIFT_ORDER_TYPE) return null;

  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-gift/10 px-2.5 text-xs font-medium text-gift",
        className
      )}
    >
      <Gift className="size-3.5" aria-hidden="true" />
      {t(GIFT_ORDER_TYPE)}
    </span>
  );
}
