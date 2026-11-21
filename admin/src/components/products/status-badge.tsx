import { useTranslations } from "next-intl";
import { Badge } from "@store/ui";

export function StatusBadge({ isActive }: { isActive: boolean }) {
  const t = useTranslations("products.status");
  return (
    <Badge tone={isActive ? "success" : "neutral"} data-testid="product-status">
      {isActive ? t("active") : t("hidden")}
    </Badge>
  );
}
