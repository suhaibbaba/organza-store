"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { EyeOff } from "lucide-react";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import type { CashSession } from "@organza/shared/types/cash";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
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

// Counting the drawer, BLIND (spec.md "Cash drawer & expenses").
//
// The expected figure is deliberately absent from this screen while the money
// is being counted. A count made with the answer in view is not a count — it
// is a chance to make the drawer agree with the books, which is exactly what
// counting exists to catch. So the flow is:
//
//   1. count    — enter what is physically there, and what is being taken out;
//   2. reveal   — the server compares, and only now does the screen show
//                 expected vs counted vs difference. A difference has to be
//                 explained before it will save, and can be flagged to follow
//                 up tomorrow;
//   3. done     — closed, with the comparison left on screen.
//
// A drawer that balances goes 1 -> 3 in a single tap; only a disagreement
// asks for anything more. The difference itself is NEVER a reason to refuse
// the close — see the backend's close route.
export function CloseDaySheet({ session, open, onOpenChange }: CloseDaySheetProps) {
  const tCommon = useTranslations("common");
  const t = useTranslations("dashboard.drawer.closeDay");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" closeLabel={tCommon("close")}>
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        {/* Keyed on `open` so a sheet reopened after being abandoned starts
            from an empty count, never from half of yesterday's attempt. */}
        <CloseDayForm key={String(open)} session={session} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
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

      // Saved. The comparison comes off the closed session, so what is shown
      // is what was actually written, not what this screen believed.
      setComparison({
        expected: closed.expected,
        counted: closed.countedAmount ?? counted,
        difference: closed.difference ?? "0",
      });
      setStep("done");
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;

      // Not a failure — this is the blind count's second half. The count
      // disagreed, and the refusal carries the figures precisely so they can
      // be revealed here, now that a count has been committed to.
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
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5">
        <Alert variant="success">{t("saved")}</Alert>
        <ComparisonPanel comparison={comparison} />
        <Button type="button" className="mt-auto h-14 w-full text-base" onClick={onDone}>
          {t("done")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5">
      {step === "counting" ? (
        // Says out loud that the figure is being withheld, so it reads as a
        // deliberate control rather than a missing number.
        <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary p-4 text-sm text-secondary-foreground">
          <EyeOff className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{t("blindHint")}</p>
        </div>
      ) : (
        comparison && <ComparisonPanel comparison={comparison} />
      )}

      {errorCode && <Alert variant="destructive">{translateError(errorCode)}</Alert>}

      {/* Once the comparison is up, the count is fixed — changing it after
          seeing the answer is exactly what counting blind prevents. It isn't
          shown as a locked field either: a greyed-out box reads like an empty
          one, and the figure is already on the panel above. */}
      {step === "counting" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="counted-amount">{t("counted")}</Label>
          <NumericInput
            id="counted-amount"
            allowDecimal
            value={counted}
            onChange={(event) => setCounted(event.target.value)}
            className="h-14 text-lg"
            placeholder="0"
          />
        </div>
      )}

      {/* Still editable at the reveal: deciding how much to bank once you
          know the drawer is short is a reasonable thing to do, and it hides
          nothing — the count itself is already committed. */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="withdrawn-amount">{t("withdrawn")}</Label>
        <NumericInput
          id="withdrawn-amount"
          allowDecimal
          value={withdrawn}
          onChange={(event) => setWithdrawn(event.target.value)}
          className="h-14 text-lg"
          placeholder="0"
        />
        <p className="text-xs text-muted-foreground">{t("withdrawnHint")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="close-note">{noteRequired ? t("noteRequired") : t("note")}</Label>
        <Textarea
          id="close-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("notePlaceholder")}
          // Required, not "invalid": a red box on a field nobody has typed in
          // yet reads as a telling-off. The label says (required), the hint
          // says why, and the save button stays disabled until it is filled.
          required={noteRequired}
          aria-describedby={noteRequired ? "close-note-hint" : undefined}
        />
        {noteRequired && (
          <p id="close-note-hint" className="text-xs text-muted-foreground">
            {t("noteRequiredHint")}
          </p>
        )}
      </div>

      {/* Only offered once there is something to carry — a balanced drawer
          has nothing to follow up. */}
      {step === "reveal" && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-4">
          <div className="min-w-0">
            <Label htmlFor="carry-difference">{t("carry")}</Label>
            <p className="mt-1 text-xs text-muted-foreground">{t("carryHint")}</p>
          </div>
          <Switch
            id="carry-difference"
            checked={carryDifference}
            onCheckedChange={setCarryDifference}
            className="mt-1 shrink-0"
          />
        </div>
      )}

      <Button
        type="button"
        className="mt-auto h-14 w-full text-base"
        disabled={!canSubmit}
        onClick={() => void submit()}
      >
        {mutation.isPending && <Spinner />}
        {step === "reveal" ? t("saveWithNote") : t("submit")}
      </Button>
    </div>
  );
}

// Expected vs counted, and the gap between them. Shown only after a count has
// been submitted — never before.
function ComparisonPanel({ comparison }: { comparison: CountComparison }) {
  const t = useTranslations("dashboard.drawer.closeDay");
  const formatMoney = useMoneyFormatter();
  const difference = Number(comparison.difference);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <ComparisonRow label={t("expected")} value={formatMoney(comparison.expected)} />
      <ComparisonRow label={t("countedShort")} value={formatMoney(comparison.counted)} />
      <ComparisonRow
        label={difference < 0 ? t("short") : difference > 0 ? t("over") : t("balanced")}
        // The sign is carried by the wording as well as the figure: "short"
        // and "over" are what someone says out loud, and a bare minus sign is
        // easy to miss.
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
      <p className={cn("text-sm", emphasis ? "font-semibold text-foreground" : "text-muted-foreground")}>
        {label}
      </p>
      <p
        className={cn(
          "shrink-0 tabular-nums",
          emphasis ? "text-lg font-bold" : "text-sm text-foreground",
          emphasis && tone === "off" && "text-amber-600 dark:text-amber-400"
        )}
      >
        {value}
      </p>
    </div>
  );
}
