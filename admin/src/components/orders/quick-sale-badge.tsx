import { useTranslations } from "next-intl";
import { Badge } from "@store/ui";
import { cn } from "@/lib/utils";

// A quick-sold line has no cost yet, so this sale's profit is overstated until completed (spec.md "Quick sell").
export function QuickSaleBadge({ className }: { className?: string }) {
  const t = useTranslations("orders");

  return (
    <Badge tone="info" icon="zap" className={cn("shrink-0", className)} data-testid="order-quick-sale-badge">
      {t("quickSale.badge")}
    </Badge>
  );
}
