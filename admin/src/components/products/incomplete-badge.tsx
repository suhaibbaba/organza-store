import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// A piece sold at the counter before it was entered, still waiting to be
// finished off (spec.md "Quick sell").
//
// It has to be MARKED rather than merely findable, and for one specific
// reason: it has no category, so the category filter — the first place
// anybody looks for a product — cannot see it at all. A row that looks
// ordinary while quietly missing its cost, its photographs and its shelf is
// how a season's worth of them go unnoticed. This says so on the row itself,
// wherever the row is drawn.
export function IncompleteBadge({ className }: { className?: string }) {
  const t = useTranslations("products.card");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary",
        className
      )}
      data-test-selector="product-incomplete-badge"
    >
      <Zap className="size-3 shrink-0" aria-hidden="true" />
      {t("incomplete")}
    </span>
  );
}
