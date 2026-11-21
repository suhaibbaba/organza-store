import { useTranslations } from "next-intl";
import { IS_SANDBOX } from "@/lib/env";
import { cn } from "@/lib/utils";

// "This is the practice copy": shown on the sandbox only, so the warning never becomes wallpaper on the live shop.
export function EnvironmentBadge({ className }: { className?: string }) {
  const t = useTranslations("app");

  if (!IS_SANDBOX) return null;

  return (
    <span
      data-test-selector="pos-environment-badge"
      className={cn(
        // No uppercase or letter-spacing: both break Arabic and Hebrew; en.json already writes it in capitals.
        "inline-flex h-6 shrink-0 items-center rounded-pill px-2 text-micro font-semibold",
        "bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-300",
        className
      )}
    >
      {t("sandbox")}
    </span>
  );
}
