"use client";

import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PermissionLockReason } from "@/types/permission";

/**
 * What stands where a switch would, for a grant nobody may change here.
 *
 * NOT a disabled switch, for either reason. A greyed-out control is the
 * universal look of something broken or still loading — an untrained user
 * taps it three times and concludes the app is faulty (CLAUDE.md "Clear
 * feedback always"), and a whole column of them reads as a page that failed
 * to load. A padlock and a sentence say the opposite: this is working exactly
 * as intended, and here is why it will not move.
 *
 * Two reasons, two sentences:
 *   "protected" — the shop's anti-theft rules, which no shop may switch off;
 *   "ownRole"   — you are editing your own role, which nobody may do.
 */
export function PermissionLock({
  reason,
  granted,
  className,
  compact = false,
}: {
  reason: PermissionLockReason;
  /**
   * Whether the role holds it, when that is still worth saying.
   *
   * For "ownRole" it very much is: the Admin column would otherwise be a
   * column of padlocks saying nothing about what an Admin can actually do,
   * which is the question this screen exists to answer. For "protected" it is
   * omitted — there the reason is the point.
   */
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
        "inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground",
        className
      )}
    >
      <Lock className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
