"use client";

import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PermissionLockReason } from "@/types/permission";

// A padlock and a sentence instead of a disabled switch, which untrained staff read as broken.
export function PermissionLock({
  reason,
  granted,
  className,
  compact = false,
}: {
  reason: PermissionLockReason;
  /** Whether the role holds it; omitted for "protected", where the reason is the point. */
  granted?: boolean;
  className?: string;
  /** Chip only, for a narrow cell where the reason is written beside it. */
  compact?: boolean;
}) {
  const t = useTranslations("permissions");

  const label =
    granted === undefined
      ? compact
        ? t("locked.label")
        : t(`locked.${reason}`)
      : t(granted ? "locked.on" : "locked.off");

  return (
    <span
      className={cn(
        "pill-text inline-flex items-center gap-1.5 rounded-pill bg-sunken px-2.5 py-1 text-meta font-medium text-ink-muted",
        className
      )}
    >
      <Lock className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
