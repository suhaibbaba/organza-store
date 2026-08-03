import { useTranslations } from "next-intl";
import { TrendingUp } from "lucide-react";

// Phase 2 (spec.md: Orders) — no orders exist yet, so this stays a
// clearly-marked placeholder rather than fabricated numbers.
export function SalesPlaceholderCard() {
  const t = useTranslations("dashboard.salesPlaceholder");

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card p-6 text-center">
      <TrendingUp className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium text-foreground">{t("title")}</p>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
    </div>
  );
}
