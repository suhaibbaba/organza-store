import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function UserStatusBadge({ isActive }: { isActive: boolean }) {
  const t = useTranslations("users.status");

  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium",
        isActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"
      )}
    >
      {isActive ? t("active") : t("inactive")}
    </span>
  );
}
