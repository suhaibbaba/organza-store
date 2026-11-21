import { useTranslations } from "next-intl";
import { Badge } from "@store/ui";

// Shown only while an invited account has never chosen a password (rule 17): allowed to sign in is the other badge, able to is this one.
export function AccountStateBadge({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("users.accountState");

  if (hasPassword) return null;

  return <Badge tone="warning">{t("pending")}</Badge>;
}
