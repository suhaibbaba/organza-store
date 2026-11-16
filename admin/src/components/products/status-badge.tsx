import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function StatusBadge({ isActive }: { isActive: boolean }) {
  const t = useTranslations("products.status");

  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium",
        isActive
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      )}
    >
      {isActive ? t("active") : t("hidden")}
    </span>
  );
}
