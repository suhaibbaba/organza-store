import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@store/ui";
import type { Role } from "@store/shared/types/role";

const ROLE_BADGE_TONES: Record<Role, BadgeTone> = {
  ADMIN: "info",
  MANAGER: "warning",
  EMPLOYEE: "neutral",
};

export function RoleBadge({ role }: { role: Role }) {
  const t = useTranslations("users.role");

  return (
    <Badge tone={ROLE_BADGE_TONES[role]} plain>
      {t(role)}
    </Badge>
  );
}
