import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// This sale contains something that was rung up before it existed in the
// catalogue (spec.md "Quick sell").
//
// Badged for the same reason a gift is: the figures on the row need
// explaining. A quick sale's line has no cost behind it, so whatever profit
// the reports show for it is overstated until somebody fills that in — and
// once the season ends, these are the orders that have to be found again and
// looked at. A filter alone would not do it; somebody scrolling the list has
// to be able to see which ones they are.
//
// Drawn only when it is true, never as "ordinary sale" on every other row.
export function QuickSaleBadge({ className }: { className?: string }) {
  const t = useTranslations("orders");

  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 text-xs font-medium text-primary",
        className
      )}
      data-test-selector="order-quick-sale-badge"
    >
      <Zap className="size-3.5" aria-hidden="true" />
      {t("quickSale.badge")}
    </span>
  );
}
