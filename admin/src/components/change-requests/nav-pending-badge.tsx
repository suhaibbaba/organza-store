"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useChangeRequestCountQuery } from "@/hooks/use-change-requests";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

// How many changes are waiting, on the navigation entry itself.
//
// It has to be visible from wherever somebody happens to be: an Admin is
// pushed a notification and then opens the app on yesterday's screen, and an
// Employee wants to know their price change has not been forgotten. The count
// is scoped by the backend — everyone's for an Admin, your own for anybody
// else — so this draws whatever number it is given.
//
// Nothing is drawn at zero: an empty badge is noise, and "0 waiting" is not
// news.
export function NavPendingBadge({ className }: { className?: string }) {
  const t = useTranslations("changeRequests");
  const locale = useLocale();
  const { data } = useChangeRequestCountQuery();
  const count = data?.pending ?? 0;
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary-foreground",
        className
      )}
      aria-label={t("badgeLabel", { count })}
    >
      {formatNumber(count, locale)}
    </span>
  );
}
