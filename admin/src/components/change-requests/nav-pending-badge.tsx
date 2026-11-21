"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useChangeRequestCountQuery } from "@/hooks/use-change-requests";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

// The backend scopes the count (everyone's for an Admin, your own otherwise); nothing is drawn at zero.
export function NavPendingBadge({ className }: { className?: string }) {
  const t = useTranslations("changeRequests");
  const locale = useLocale();
  const { data } = useChangeRequestCountQuery();
  const count = data?.pending ?? 0;
  if (count <= 0) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-pill bg-primary-600 px-1.5 py-0.5 text-micro font-semibold leading-none text-ink-inverse",
        className,
      )}
      aria-label={t("badgeLabel", { count })}
    >
      {formatNumber(count, locale)}
    </span>
  );
}
