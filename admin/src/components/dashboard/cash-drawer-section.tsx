"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Calculator, Check } from "lucide-react";
import type { CashSession, CurrentCashSession } from "@store/shared/types/cash";
import { Alert, Button, Card } from "@store/ui";
import { ExplainedLabel } from "@/components/figures/explained-label";
import { CloseDaySheet } from "@/components/dashboard/close-day-sheet";
import { OpenDaySheet } from "@/components/dashboard/open-day-sheet";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { formatDate } from "@/lib/format";
import { toLocalDateString } from "@/lib/report-range";
import { cn } from "@/lib/utils";

// Opening float + cash sales − cash expenses = expected now, written line by line so a disagreeing count shows WHERE the expectation came from.
export function CashDrawerSection({ current }: { current: CurrentCashSession }) {
  const t = useTranslations("dashboard.drawer");
  const tFigures = useTranslations("figures");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const [opening, setOpening] = useState(false);

  // Held locally: closing makes `current` null, which would unmount the sheet and its reveal the instant it saved.
  const [countingSession, setCountingSession] = useState<CashSession | null>(null);

  const session = current.session;
  const today = toLocalDateString(new Date());
  // A day counted and signed off — not the same thing as no day at all.
  const closedToday = !session && current.lastClosed?.date === today ? current.lastClosed : null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-section font-semibold text-ink">{t("title")}</h2>
        <p className="text-label text-ink-muted">{t("subtitle")}</p>
      </div>

      {session ? (
        <>
          <Card className="flex flex-col gap-2">
            {/* An earlier uncounted day is still the open drawer — name it rather than let "today" mean last Thursday. */}
            {session.date !== today && (
              <Alert tone="warning">{t("staleDay", { date: formatDate(session.date, locale) })}</Alert>
            )}

            <CalculationRow
              label={t("openingFloat.label")}
              description={t("openingFloat.help")}
              toggleLabel={tFigures("explain", { label: t("openingFloat.label") })}
              value={formatMoney(session.openingFloat)}
            />
            <CalculationRow label={t("cashSales")} value={formatMoney(session.cashSales)} sign="+" />
            <CalculationRow label={t("cashExpenses")} value={formatMoney(session.cashExpenses)} sign="−" />

            <hr className="my-1 border-line" />

            <CalculationRow
              label={t("expected.label")}
              description={t("expected.help")}
              toggleLabel={tFigures("explain", { label: t("expected.label") })}
              value={formatMoney(session.expected)}
              sign="="
              emphasis
            />
          </Card>

          {/* Amber: an uncounted drawer is an open loop, not an error. */}
          <div className="flex flex-col gap-3 rounded-card border border-warning-300 bg-warning-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-warning-800">{t("notClosed.title")}</p>
              <p className="mt-1 text-label text-ink-muted">{t("notClosed.body")}</p>
            </div>
            <Button
              type="button"
              className="w-full shrink-0 sm:w-auto"
              icon={<Calculator className="size-4" aria-hidden="true" />}
              onClick={() => setCountingSession(session)}
            >
              {t("notClosed.action")}
            </Button>
          </div>
        </>
      ) : closedToday ? (
        <ClosedDayCard session={closedToday} />
      ) : (
        <Card className="flex flex-col gap-3">
          <div>
            <p className="font-semibold text-ink">{t("notStarted.title")}</p>
            <p className="mt-1 text-label text-ink-muted">
              {t("notStarted.body", { amount: formatMoney(current.suggestedOpeningFloat) })}
            </p>
          </div>
          <Button type="button" className="w-full sm:w-auto sm:self-start" onClick={() => setOpening(true)}>
            {t("notStarted.action")}
          </Button>
        </Card>
      )}

      <OpenDaySheet open={opening} onOpenChange={setOpening} suggestedOpeningFloat={current.suggestedOpeningFloat} />

      {/* Mounted from local state so it survives `current` losing the drawer on save. */}
      {countingSession && (
        <CloseDaySheet
          key={countingSession.id}
          session={countingSession}
          open
          onOpenChange={(next) => {
            if (!next) {
              setCountingSession(null);
            }
          }}
        />
      )}
    </section>
  );
}

// A difference stays visible the next time someone opens the app, not buried.
function ClosedDayCard({ session }: { session: CashSession }) {
  const t = useTranslations("dashboard.drawer");
  const formatMoney = useMoneyFormatter();
  const difference = Number(session.difference ?? 0);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Check className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold text-ink">{t("closed.title")}</p>
          <p className="mt-1 text-label text-ink-muted">
            {t("closed.body", {
              counted: formatMoney(session.countedAmount ?? "0"),
              carried: formatMoney(session.closingBalance ?? "0"),
            })}
          </p>
        </div>
      </div>

      {difference !== 0 && (
        <Alert tone="warning">
          {difference < 0
            ? t("closed.short", { amount: formatMoney(Math.abs(difference)) })
            : t("closed.over", { amount: formatMoney(difference) })}
          {session.note ? ` — ${session.note}` : ""}
        </Alert>
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
      {/* Operator outside the label keeps the labels aligned like a written-out sum. */}
      {sign && (
        <span aria-hidden="true" className="flex min-h-11 w-3 shrink-0 items-center text-label text-ink-muted">
          {sign}
        </span>
      )}
      <ExplainedLabel
        className="flex-1"
        label={label}
        description={description}
        toggleLabel={toggleLabel ?? label}
        labelClassName={emphasis ? "font-semibold text-ink" : undefined}
        trailing={
          <span
            className={cn("tabular-nums", emphasis ? "text-section font-bold text-ink" : "text-label text-ink-muted")}
          >
            {value}
          </span>
        }
      />
    </div>
  );
}
