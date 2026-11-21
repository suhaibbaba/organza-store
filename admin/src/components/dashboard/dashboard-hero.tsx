"use client";

import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Plus, Printer, Sun, Sunset, Moon } from "lucide-react";
import { can } from "@store/shared/lib/permissions";
import { buttonClassName, Typography } from "@store/ui";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { formatLongDate, formatTime } from "@/lib/format";
import { toLocalDateString } from "@/lib/report-range";
import { cn } from "@/lib/utils";
import { GREETING_AFTERNOON_HOUR, GREETING_EVENING_HOUR } from "@/constants/dashboard";
import type { DashboardHeroProps } from "@/types/dashboard";

function greetingFor(hour: number) {
  if (hour < GREETING_AFTERNOON_HOUR) {
    return { key: "morning", Icon: Sun } as const;
  }
  if (hour < GREETING_EVENING_HOUR) {
    return { key: "afternoon", Icon: Sunset } as const;
  }
  return { key: "evening", Icon: Moon } as const;
}

// The day at a glance: who, when, whether the drawer is open, today's takings, and the three things started most.
export function DashboardHero({ name, today, drawer }: DashboardHeroProps) {
  const t = useTranslations("dashboard.hero");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const { user } = useSession();
  const now = new Date();
  const greeting = greetingFor(now.getHours());
  const { totals } = today;

  const session = drawer?.session ?? null;
  const closedToday = !session && drawer?.lastClosed?.date === toLocalDateString(now);
  const drawerLine = session
    ? t("openSince", { time: formatTime(session.openedAt, locale) })
    : closedToday
      ? t("closed")
      : t("notOpen");

  const revenue = Number(totals.revenue);
  const receivedShare = revenue > 0 ? Math.min(100, (Number(totals.collectedRevenue) / revenue) * 100) : 0;

  const actions = [
    { key: "newOrder", href: "/orders/new", icon: Plus, show: can(user, "order.create"), variant: "inverse" },
    { key: "newProduct", href: "/products/new", icon: Plus, show: can(user, "product.create"), variant: "glass" },
    { key: "printLabels", href: "/labels", icon: Printer, show: can(user, "product.printLabels"), variant: "glass" },
  ] as const;

  return (
    <section
      aria-label={t("label")}
      data-test-selector="dashboard-hero"
      className="relative isolate flex animate-rise flex-wrap items-center justify-between gap-6 overflow-hidden rounded-card bg-linear-125 from-primary-900 via-primary-700 to-primary-500 p-5 text-ink-inverse shadow-float sm:p-8"
    >
      <span
        aria-hidden="true"
        className="absolute -top-28 -z-10 size-72 animate-float rounded-full bg-warning-300/35 blur-3xl ltr:-right-16 rtl:-left-16"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-24 -z-10 size-52 animate-float rounded-full bg-white/5 [animation-delay:-3s] ltr:right-1/3 rtl:left-1/3"
      />

      <div className="flex min-w-0 flex-col gap-3">
        <span className="inline-flex items-center gap-2 self-start rounded-pill bg-white/15 px-3 py-1.5 text-label backdrop-blur-sm">
          <CalendarDays className="size-4" aria-hidden="true" />
          <span data-test-selector="dashboard-hero-date">{formatLongDate(now, locale)}</span>
        </span>

        <Typography
          variant="h1"
          as="h1"
          className="flex items-center gap-3 text-[28px] leading-tight text-ink-inverse sm:text-[34px]"
        >
          {t(greeting.key, { name })}
          <greeting.Icon className="size-8 shrink-0 text-warning-300" aria-hidden="true" />
        </Typography>

        <Typography variant="body" as="p" className="flex items-center gap-2.5 text-ink-inverse/85">
          <span
            aria-hidden="true"
            className={cn("size-2.5 shrink-0 rounded-full", session ? "animate-live bg-success-500" : "bg-white/50")}
          />
          {drawerLine} · {t("ordersToday", { count: totals.orderCount })}
        </Typography>

        <div className="mt-1 flex flex-wrap gap-2.5">
          {actions
            .filter((action) => action.show)
            .map(({ key, href, icon: Icon, variant }) => (
              <Link
                key={key}
                href={href}
                data-test-selector={`dashboard-action-${key}`}
                className={buttonClassName({ variant })}
              >
                <Icon className="size-4" aria-hidden="true" />
                {t(key)}
              </Link>
            ))}
        </div>
      </div>

      <div
        data-test-selector="dashboard-hero-sales"
        className="flex w-full flex-col gap-1.5 rounded-card border border-white/20 bg-white/10 p-5 backdrop-blur-md sm:w-auto sm:min-w-64"
      >
        <Typography variant="small" as="span" className="text-ink-inverse/80">
          {t("todaySales")}
        </Typography>
        <span className="text-[32px] leading-tight font-bold tabular-nums">{formatMoney(totals.revenue)}</span>
        <span className="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-white/20" aria-hidden="true">
          <span
            className="block h-full animate-grow-in rounded-pill bg-warning-300 ltr:origin-left rtl:origin-right"
            style={{ width: `${receivedShare}%` }}
          />
        </span>
        <Typography variant="caption" as="span" className="text-ink-inverse/75">
          {t("receivedShare", {
            received: formatMoney(totals.collectedRevenue),
            owed: formatMoney(totals.pendingCollectionAmount),
          })}
        </Typography>
      </div>
    </section>
  );
}
