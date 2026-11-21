import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// A quick-sold line has no cost yet, so this sale's profit is overstated until completed (spec.md "Quick sell"); drawn only when true.
export function QuickSaleBadge({ className }: { className?: string }) {
  const t = useTranslations("orders");

  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-pill bg-primary-100 px-2.5 text-micro font-medium text-primary-600",
        className
      )}
      data-test-selector="order-quick-sale-badge"
    >
      <Zap className="size-3.5" aria-hidden="true" />
      {t("quickSale.badge")}
    </span>
  );
}
