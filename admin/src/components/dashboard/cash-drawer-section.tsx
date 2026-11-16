"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Calculator, Check } from "lucide-react";
import type { CashSession, CurrentCashSession } from "@organza/shared/types/cash";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ExplainedLabel } from "@/components/figures/explained-label";
import { CloseDaySheet } from "@/components/dashboard/close-day-sheet";
import { OpenDaySheet } from "@/components/dashboard/open-day-sheet";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { formatDate } from "@/lib/format";
import { toLocalDateString } from "@/lib/report-range";
import { cn } from "@/lib/utils";

// The cash drawer, shown as the sum it actually is (spec.md "Cash drawer &
// expenses"):
//
//   Cash at open (this morning) + cash sales − cash expenses = expected now
//
// Written out line by line rather than as one total, because the whole point
// of the drawer is being able to see WHERE the expectation came from when the
// count disagrees. The wording separates the two figures people confuse: the
// float the day STARTED with, and what should be in there NOW.
//
// Three states, and the section says which one it is in rather than leaving
// it to be inferred: a drawer running, a day counted and closed, or no drawer
// started yet.
export function CashDrawerSection({ current }: { current: CurrentCashSession }) {
  const t = useTranslations("dashboard.drawer");
  const tFigures = useTranslations("figures");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const [opening, setOpening] = useState(false);

  // The session being counted is held here rather than read from `current`
  // while the sheet is up. Closing the day makes the server's "current"
  // drawer null, and if the sheet's session came from there the whole sheet
  // would unmount the instant it saved — taking the reveal (expected vs
  // counted vs difference) with it, which is the one thing the count is for.
  const [countingSession, setCountingSession] = useState<CashSession | null>(null);

  const session = current.session;
  const today = toLocalDateString(new Date());
  // A day counted and signed off — not the same thing as no day at all.
  const closedToday = !session && current.lastClosed?.date === today ? current.lastClosed : null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {session ? (
        <>
          <Card className="flex flex-col gap-2 p-4">
            {/* The drawer on screen is the newest one open — normally today's.
                If an earlier day was never counted it is still this one, so
                say which day it is rather than letting "today" quietly mean
                last Thursday. */}
            {session.date !== today && (
              <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                {t("staleDay", { date: formatDate(session.date, locale) })}
              </p>
            )}

            <CalculationRow
              label={t("openingFloat.label")}
              description={t("openingFloat.help")}
              toggleLabel={tFigures("explain", { label: t("openingFloat.label") })}
              value={formatMoney(session.openingFloat)}
            />
            <CalculationRow label={t("cashSales")} value={formatMoney(session.cashSales)} sign="+" />
            <CalculationRow label={t("cashExpenses")} value={formatMoney(session.cashExpenses)} sign="−" />

            <Separator className="my-1" />

            <CalculationRow
              label={t("expected.label")}
              description={t("expected.help")}
              toggleLabel={tFigures("explain", { label: t("expected.label") })}
              value={formatMoney(session.expected)}
              sign="="
              emphasis
            />
          </Card>

          {/* The day's status and the one action that changes it. Amber
              because an uncounted drawer is an open loop, not an error. */}
          <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-amber-700 dark:text-amber-400">{t("notClosed.title")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("notClosed.body")}</p>
            </div>
            <Button
              type="button"
              className="h-12 w-full shrink-0 text-base sm:w-auto"
              onClick={() => setCountingSession(session)}
            >
              <Calculator className="size-5" aria-hidden="true" />
              {t("notClosed.action")}
            </Button>
          </div>
        </>
      ) : closedToday ? (
        <ClosedDayCard session={closedToday} />
      ) : (
        <Card className="flex flex-col gap-3 p-4">
          <div>
            <p className="font-semibold text-foreground">{t("notStarted.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("notStarted.body", { amount: formatMoney(current.suggestedOpeningFloat) })}
            </p>
          </div>
          <Button type="button" className="h-12 w-full text-base sm:w-auto sm:self-start" onClick={() => setOpening(true)}>
            {t("notStarted.action")}
          </Button>
        </Card>
      )}

      <OpenDaySheet
        open={opening}
        onOpenChange={setOpening}
        suggestedOpeningFloat={current.suggestedOpeningFloat}
      />

      {/* Mounted from local state, so it survives the drawer disappearing
          from `current` the moment the count is saved. */}
      {countingSession && (
        <CloseDaySheet
          key={countingSession.id}
          session={countingSession}
          open
          onOpenChange={(next) => {
            if (!next) setCountingSession(null);
          }}
        />
      )}
    </section>
  );
}

// The day, counted and signed off. Shows what it came to — a difference is
// worth seeing again the next time someone opens the app, not buried.
function ClosedDayCard({ session }: { session: CashSession }) {
  const t = useTranslations("dashboard.drawer");
  const formatMoney = useMoneyFormatter();
  const difference = Number(session.difference ?? 0);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{t("closed.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("closed.body", {
              counted: formatMoney(session.countedAmount ?? "0"),
              carried: formatMoney(session.closingBalance ?? "0"),
            })}
          </p>
        </div>
      </div>

      {difference !== 0 && (
        <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          {difference < 0
            ? t("closed.short", { amount: formatMoney(Math.abs(difference)) })
            : t("closed.over", { amount: formatMoney(difference) })}
          {session.note ? ` — ${session.note}` : ""}
        </p>
      )}
    </Card>
  );
}

interface CalculationRowProps {
  label: string;
  value: string;
  description?: string;
  toggleLabel?: string;
  // The operator that makes the running sum readable as a sum.
  sign?: "+" | "−" | "=";
  emphasis?: boolean;
}

function CalculationRow({ label, value, description, toggleLabel, sign, emphasis }: CalculationRowProps) {
  return (
    <div className="flex items-start gap-1.5">
      {/* The operator sits outside the label so the labels themselves stay
          aligned down the column, the way a written-out sum reads. */}
      {sign && (
        <span aria-hidden="true" className="flex min-h-11 w-3 shrink-0 items-center text-sm text-muted-foreground">
          {sign}
        </span>
      )}
      <ExplainedLabel
        className="flex-1"
        label={label}
        description={description}
        toggleLabel={toggleLabel ?? label}
        labelClassName={emphasis ? "font-semibold text-foreground" : undefined}
        trailing={
          <span
            className={cn(
              "tabular-nums",
              emphasis ? "text-base font-bold text-foreground" : "text-sm text-muted-foreground"
            )}
          >
            {value}
          </span>
        }
      />
    </div>
  );
}
