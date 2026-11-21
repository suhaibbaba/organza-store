import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// Marked, not just findable: a quick-sold piece has no category, so the category filter can't see it (spec.md "Quick sell").
export function IncompleteBadge({ className }: { className?: string }) {
  const t = useTranslations("products.card");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-pill bg-primary-50 px-2 py-0.5 text-micro font-medium text-primary-600",
        className
      )}
      data-test-selector="product-incomplete-badge"
    >
      <Zap className="size-3 shrink-0" aria-hidden="true" />
      {t("incomplete")}
    </span>
  );
}
