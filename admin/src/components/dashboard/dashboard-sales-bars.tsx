"use client";

import { useLocale, useTranslations } from "next-intl";
import { ChartColumn } from "lucide-react";
import { Typography } from "@store/ui";
import { DetailCard } from "@/components/layout/detail-card";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DASHBOARD_BAR_STEP_MS } from "@/constants/dashboard";
import type { DashboardSalesBarsProps } from "@/types/dashboard";

const BAR_MIN_PERCENT = 2;

function weekdayOf(date: string, locale: string, width: "long" | "short" | "narrow"): string {
  return new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

// Seven bars, today the dark one; each bar is scaled to the best day, so the tallest is always full height.
export function DashboardSalesBars({ daily }: DashboardSalesBarsProps) {
  const t = useTranslations("dashboard.bars");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const { days } = daily;

  const values = days.map((day) => Number(day.revenue));
  const best = Math.max(0, ...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  const bestDay = best > 0 ? days[values.indexOf(best)] : null;
  const lastIndex = days.length - 1;

  return (
    <DetailCard
      icon={ChartColumn}
      title={t("title")}
      data-testid="dashboard-sales-bars"
      className="animate-rise [animation-delay:250ms]"
      action={
        <Typography variant="small" tone="muted" as="span" className="tabular-nums">
          {t("total", { amount: formatMoney(total) })}
        </Typography>
      }
    >
      <ol
        aria-label={t("chart")}
        className="grid h-56 grid-cols-7 items-end gap-2 bg-[repeating-linear-gradient(to_top,var(--color-line)_0,var(--color-line)_1px,transparent_1px,transparent_25%)] sm:gap-4"
      >
        {days.map((day, index) => {
          const isToday = index === lastIndex;
          const value = values[index];
          const height = best > 0 ? Math.max(BAR_MIN_PERCENT, (value / best) * 100) : BAR_MIN_PERCENT;
          const dayName = isToday ? t("today") : weekdayOf(day.date, locale, "long");

          return (
            <li
              key={day.date}
              aria-label={t("day", { day: dayName, amount: formatMoney(day.revenue) })}
              data-test-selector={`dashboard-sales-bar-${day.date}`}
              className="flex h-full flex-col items-center justify-end gap-1.5"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "hidden text-caption tabular-nums sm:block",
                  isToday ? "font-semibold text-primary-900" : "text-ink-muted",
                )}
              >
                {value > 0 ? formatNumber(Math.round(value), locale) : ""}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "block w-full max-w-12 origin-bottom animate-grow-up rounded-control",
                  isToday ? "bg-linear-to-b from-primary-500 to-primary-900 shadow-float" : "bg-primary-200",
                )}
                style={{ height: `${height}%`, animationDelay: `${300 + index * DASHBOARD_BAR_STEP_MS}ms` }}
              />
            </li>
          );
        })}
      </ol>

      <div aria-hidden="true" className="-mt-2 grid grid-cols-7 gap-2 sm:gap-4">
        {days.map((day, index) => (
          <Typography
            key={day.date}
            variant="caption"
            as="span"
            className={cn("text-center", index === lastIndex ? "font-semibold text-primary-900" : "text-ink-muted")}
          >
            {index === lastIndex ? (
              t("today")
            ) : (
              <>
                <span className="sm:hidden">{weekdayOf(day.date, locale, "narrow")}</span>
                <span className="hidden sm:inline">{weekdayOf(day.date, locale, "short")}</span>
              </>
            )}
          </Typography>
        ))}
      </div>

      <Typography variant="small" tone="muted" as="p">
        {bestDay
          ? t("best", { day: `${weekdayOf(bestDay.date, locale, "long")} ${formatMoney(bestDay.revenue)}` })
          : t("none")}
      </Typography>
    </DetailCard>
  );
}
