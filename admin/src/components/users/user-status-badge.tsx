import { useTranslations } from "next-intl";
import { Badge } from "@store/ui";

export function UserStatusBadge({ isActive }: { isActive: boolean }) {
  const t = useTranslations("users.status");

  return <Badge tone={isActive ? "success" : "neutral"}>{isActive ? t("active") : t("inactive")}</Badge>;
}
