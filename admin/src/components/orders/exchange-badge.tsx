import { useTranslations } from "next-intl";
import { Badge } from "@store/ui";
import { cn } from "@/lib/utils";

// This order's pieces replaced pieces brought back from another sale (spec.md "Exchanges").
export function ExchangeBadge({ className }: { className?: string }) {
  const t = useTranslations("orders");

  return (
    <Badge
      tone="violet"
      icon="move-horizontal"
      className={cn("shrink-0", className)}
      data-testid="order-exchange-badge"
    >
      {t("exchange.badge")}
    </Badge>
  );
}
