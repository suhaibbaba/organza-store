"use client";

import { MoneyField } from "@/components/fields/money-field";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { EyeOff } from "lucide-react";
import { ERROR_CODES } from "@store/shared/constants/errors";
import type { CashSession } from "@store/shared/types/cash";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { Alert, Button, Drawer, FormField, Switch, Textarea } from "@store/ui";
import { useCloseCashSessionMutation } from "@/hooks/use-cash-sessions";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import type { CloseDayStep, CountComparison } from "@/types/dashboard";

interface CloseDaySheetProps {
  session: CashSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Counted BLIND: the expected figure stays hidden until a count is committed, so nobody can make the drawer agree with the books; a difference needs a note but never refuses the close.
export function CloseDaySheet({ session, open, onOpenChange }: CloseDaySheetProps) {
  const t = useTranslations("dashboard.drawer.closeDay");

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      descriptionKey="dashboard.drawer.closeDay.title"
      data-testid="sheet-close-day"
    >
      {/* Keyed on `open` so a reopened sheet starts from an empty count. */}
      <CloseDayForm key={String(open)} session={session} onDone={() => onOpenChange(false)} />
    </Drawer>
  );
}

function CloseDayForm({ session, onDone }: { session: CashSession; onDone: () => void }) {
  const t = useTranslations("dashboard.drawer.closeDay");
  const translateError = useTranslateError();
  const mutation = useCloseCashSessionMutation(session.id);

  const [step, setStep] = useState<CloseDayStep>("counting");
  const [counted, setCounted] = useState("");
  const [withdrawn, setWithdrawn] = useState("");
  const [note, setNote] = useState("");
  const [carryDifference, setCarryDifference] = useState(false);
  const [comparison, setComparison] = useState<CountComparison | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const noteRequired = step === "reveal";
  const canSubmit =
    counted.trim() !== "" && !mutation.isPending && (!noteRequired || note.trim() !== "");

  async function submit() {
    if (!canSubmit) return;
    setErrorCode(null);

    try {
      const closed = await mutation.mutateAsync({
        countedAmount: counted.trim(),
        ...(withdrawn.trim() ? { withdrawnAmount: withdrawn.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        carryDifference,
      });

      // Shown from the closed session: what was written, not what this screen believed.
      setComparison({
        expected: closed.expected,
        counted: closed.countedAmount ?? counted,
        difference: closed.difference ?? "0",
      });
      setStep("done");
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;

      // Not a failure: the blind count's second half — the refusal carries the figures to reveal.
      if (apiError?.code === ERROR_CODES.CASH_SESSION_DIFFERENCE_NOTE_REQUIRED) {
        const details = apiError.details as Partial<CountComparison> | undefined;
        if (details?.expected && details.counted && details.difference) {
          setComparison(details as CountComparison);
          setStep("reveal");
          return;
        }
      }

      setErrorCode(apiError?.code ?? ERROR_CODES.INTERNAL);
    }
  }

  if (step === "done" && comparison) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">{t("saved")}</Alert>
        <ComparisonPanel comparison={comparison} />
        <Button type="button" className="w-full" onClick={onDone}>
          {t("done")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {step === "counting" ? (
        // Says the figure is withheld on purpose, so it never reads as a missing number.
        <div className="flex items-start gap-3 rounded-panel border border-line bg-inset p-4 text-label text-ink">
          <EyeOff className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{t("blindHint")}</p>
        </div>
      ) : (
        comparison && <ComparisonPanel comparison={comparison} />
      )}

      {errorCode && <Alert tone="danger">{translateError(errorCode)}</Alert>}

      {/* After the reveal the count is fixed — changing it after seeing the answer is what counting blind prevents. */}
      {step === "counting" && (
        <FormField label="dashboard.drawer.closeDay.counted" htmlFor="counted-amount">
          <MoneyField
            id="counted-amount"
            value={counted}
            onChange={(event) => setCounted(event.target.value)}
            placeholder="0"
          />
        </FormField>
      )}

      {/* Still editable at the reveal: the count is already committed, so this hides nothing. */}
      <FormField
        label="dashboard.drawer.closeDay.withdrawn"
        htmlFor="withdrawn-amount"
        note="dashboard.drawer.closeDay.withdrawnHint"
      >
        <MoneyField
          id="withdrawn-amount"
          value={withdrawn}
          onChange={(event) => setWithdrawn(event.target.value)}
          placeholder="0"
        />
      </FormField>

      <FormField
        label={noteRequired ? "dashboard.drawer.closeDay.noteRequired" : "dashboard.drawer.closeDay.note"}
        htmlFor="close-note"
      >
        <Textarea
          id="close-note"
          data-testid={fieldTestSelector("close-note")}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("notePlaceholder")}
          // Required, not "invalid": a red box before anyone typed reads as a telling-off.
          required={noteRequired}
          aria-describedby={noteRequired ? "close-note-hint" : undefined}
        />
        {noteRequired && (
          <p id="close-note-hint" className="text-label text-ink-muted">
            {t("noteRequiredHint")}
          </p>
        )}
      </FormField>

      {/* Only offered once there is a difference to carry. */}
      {step === "reveal" && (
        <div className="flex items-start justify-between gap-3 rounded-panel border border-line p-4">
          <div className="min-w-0">
            <label htmlFor="carry-difference" className="cursor-pointer text-label text-ink">
              {t("carry")}
            </label>
            <p className="mt-1 text-meta text-ink-muted">{t("carryHint")}</p>
          </div>
          <div className="mt-1 shrink-0">
            <Switch
              id="carry-difference"
              data-testid={fieldTestSelector("carry-difference")}
              label={t("carry")}
              hideLabel
              checked={carryDifference}
              onCheckedChange={setCarryDifference}
            />
          </div>
        </div>
      )}

      <Button
        type="button"
        className="w-full"
        disabled={!canSubmit}
        isLoading={mutation.isPending}
        onClick={() => void submit()}
      >
        {step === "reveal" ? t("saveWithNote") : t("submit")}
      </Button>
    </div>
  );
}

// Shown only after a count has been submitted — never before.
function ComparisonPanel({ comparison }: { comparison: CountComparison }) {
  const t = useTranslations("dashboard.drawer.closeDay");
  const formatMoney = useMoneyFormatter();
  const difference = Number(comparison.difference);

  return (
    <div className="flex flex-col gap-2 rounded-panel border border-line bg-surface p-4">
      <ComparisonRow label={t("expected")} value={formatMoney(comparison.expected)} />
      <ComparisonRow label={t("countedShort")} value={formatMoney(comparison.counted)} />
      <ComparisonRow
        label={difference < 0 ? t("short") : difference > 0 ? t("over") : t("balanced")}
        // "Short"/"over" carry the sign in words; a bare minus is easy to miss.
        value={formatMoney(Math.abs(difference))}
        tone={difference === 0 ? "balanced" : "off"}
        emphasis
      />
    </div>
  );
}

function ComparisonRow({
  label,
  value,
  tone = "balanced",
  emphasis,
}: {
  label: string;
  value: string;
  tone?: "balanced" | "off";
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className={cn("text-label", emphasis ? "font-semibold text-ink" : "text-ink-muted")}>
        {label}
      </p>
      <p
        className={cn(
          "shrink-0 tabular-nums",
          emphasis ? "text-heading font-bold text-ink" : "text-label text-ink",
          emphasis && tone === "off" && "text-warning-700"
        )}
      >
        {value}
      </p>
    </div>
  );
}
