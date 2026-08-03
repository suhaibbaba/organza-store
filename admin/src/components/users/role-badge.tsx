import { useTranslations } from "next-intl";
import type { Role } from "@shared/types/role";
import { cn } from "@/lib/utils";

const ROLE_BADGE_STYLES: Record<Role, string> = {
  ADMIN: "bg-primary/10 text-primary",
  MANAGER: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  EMPLOYEE: "bg-secondary text-secondary-foreground",
};

export function RoleBadge({ role }: { role: Role }) {
  const t = useTranslations("users.role");

  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium", ROLE_BADGE_STYLES[role])}>
      {t(role)}
    </span>
  );
}
