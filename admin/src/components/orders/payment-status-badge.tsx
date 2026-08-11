import { useTranslations } from "next-intl";
import { BanknoteArrowDown, Wallet } from "lucide-react";
import type { PaymentStatus } from "@organza/shared/types/order";
import { cn } from "@/lib/utils";

// Has the money for this sale actually reached the shop? Kept visually
// distinct from the order-status badge (which is about the goods) so a glance
// down a list never confuses "delivered" with "paid for" — the whole reason
// the two are separate fields (spec.md "Payment collection").
//
// Amber for money still out there, green for money in hand; the icon and the
// wording carry the same meaning, so colour is never the only signal.
const PAYMENT_BADGE_STYLES: Record<PaymentStatus, string> = {
  PENDING_COLLECTION: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  COLLECTED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

const PAYMENT_BADGE_ICONS: Record<PaymentStatus, typeof Wallet> = {
  PENDING_COLLECTION: BanknoteArrowDown,
  COLLECTED: Wallet,
};

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  const t = useTranslations("orders.paymentStatus");
  const Icon = PAYMENT_BADGE_ICONS[status];

  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium",
        PAYMENT_BADGE_STYLES[status],
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {t(status)}
    </span>
  );
}
