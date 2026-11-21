import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function StatusBadge({ isActive }: { isActive: boolean }) {
  const t = useTranslations("products.status");

  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-pill px-2.5 text-micro font-medium",
        isActive ? "bg-primary-50 text-primary-600" : "bg-inset text-ink-muted"
      )}
    >
      {isActive ? t("active") : t("hidden")}
    </span>
  );
}
