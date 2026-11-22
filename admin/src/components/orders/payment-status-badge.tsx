import { useTranslations } from "next-intl";
import { Badge, type BadgeVariant, type IconName } from "@store/ui";
import type { PaymentStatus } from "@store/shared/types/order";
import { cn } from "@/lib/utils";

// Kept visually distinct from the order-status badge so "delivered" is never read as "paid for" (spec.md "Payment collection").
const PAYMENT_BADGE_TONES: Record<PaymentStatus, BadgeVariant> = {
  PENDING_COLLECTION: "warning",
  COLLECTED: "success",
  ON_CREDIT: "danger",
};

const PAYMENT_BADGE_ICONS: Record<PaymentStatus, IconName> = {
  PENDING_COLLECTION: "banknote",
  COLLECTED: "wallet",
  ON_CREDIT: "clock",
};

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  const t = useTranslations("orders.paymentStatus");

  return (
    <Badge tone={PAYMENT_BADGE_TONES[status]} icon={PAYMENT_BADGE_ICONS[status]} className={cn("shrink-0", className)}>
      {t(status)}
    </Badge>
  );
}
