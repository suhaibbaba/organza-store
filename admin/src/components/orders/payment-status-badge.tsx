import { useTranslations } from "next-intl";
import { BanknoteArrowDown, Wallet } from "lucide-react";
import type { PaymentStatus } from "@organza/shared/types/order";
import { cn } from "@/lib/utils";

// Kept visually distinct from the order-status badge so "delivered" is never read as "paid for" (spec.md "Payment collection").
const PAYMENT_BADGE_STYLES: Record<PaymentStatus, string> = {
  PENDING_COLLECTION: "bg-warning-100 text-warning-700",
  COLLECTED: "bg-success-100 text-success-900",
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
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-pill px-2.5 text-micro font-medium",
        PAYMENT_BADGE_STYLES[status],
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {t(status)}
    </span>
  );
}
