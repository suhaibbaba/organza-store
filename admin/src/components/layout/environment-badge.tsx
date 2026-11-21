import { useTranslations } from "next-intl";
import { IS_SANDBOX } from "@/lib/env";
import { cn } from "@/lib/utils";

// Sandbox-only "practice copy" chip, so nobody mistakes the sandbox for the live shop; renders nothing in production.
export function EnvironmentBadge({ className }: { className?: string }) {
  const t = useTranslations("app");

  if (!IS_SANDBOX) {
    return null;
  }

  return (
    <span
      data-test-selector="environment-badge"
      className={cn(
        // No uppercase/letter-spacing: both break Arabic and Hebrew joins.
        "pill-text inline-flex h-6 shrink-0 items-center rounded-pill border border-warning-300 bg-warning-50 px-2 text-micro font-semibold text-warning-800",
        className,
      )}
    >
      {t("sandbox")}
    </span>
  );
}
