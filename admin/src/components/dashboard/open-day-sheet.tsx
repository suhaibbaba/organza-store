"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { useOpenCashSessionMutation } from "@/hooks/use-cash-sessions";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { timezoneOffsetMinutes } from "@/lib/report-range";

interface OpenDaySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // What last night's count left in the drawer. Pre-filled rather than
  // remembered by a person overnight — that carry-over is the whole reason
  // the withdrawal is recorded at close.
  suggestedOpeningFloat: string;
}

// Starting the day's drawer. The float is editable because the owner
// sometimes puts a different amount in by hand, but the common case is
// tapping the button and accepting what is already there.
export function OpenDaySheet({ open, onOpenChange, suggestedOpeningFloat }: OpenDaySheetProps) {
  const tCommon = useTranslations("common");
  const t = useTranslations("dashboard.drawer.openDay");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" closeLabel={tCommon("close")}>
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        {/* Keyed so the field starts from the suggestion again each time the
            sheet is opened, rather than showing what was last abandoned. */}
        <OpenDayForm
          key={String(open)}
          suggestedOpeningFloat={suggestedOpeningFloat}
          onDone={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function OpenDayForm({
  suggestedOpeningFloat,
  onDone,
}: {
  suggestedOpeningFloat: string;
  onDone: () => void;
}) {
  const t = useTranslations("dashboard.drawer.openDay");
  const translateError = useTranslateError();
  const formatMoney = useMoneyFormatter();
  const mutation = useOpenCashSessionMutation();

  const [openingFloat, setOpeningFloat] = useState(suggestedOpeningFloat);
  const [note, setNote] = useState("");

  const canSubmit = openingFloat.trim() !== "" && !mutation.isPending;

  function submit() {
    if (!canSubmit) return;
    mutation.mutate(
      {
        tzOffset: timezoneOffsetMinutes(),
        openingFloat: openingFloat.trim(),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      { onSuccess: onDone }
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5">
      <p className="text-sm text-muted-foreground">
        {t("description", { amount: formatMoney(suggestedOpeningFloat) })}
      </p>

      {mutation.isError && (
        <Alert variant="destructive">
          {translateError(mutation.error instanceof ApiError ? mutation.error.code : ERROR_CODES.INTERNAL)}
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="opening-float">{t("openingFloat")}</Label>
        <NumericInput
          id="opening-float"
          allowDecimal
          value={openingFloat}
          onChange={(event) => setOpeningFloat(event.target.value)}
          className="h-14 text-lg"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="open-note">{t("note")}</Label>
        <Textarea
          id="open-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("notePlaceholder")}
        />
      </div>

      <Button type="button" className="mt-auto h-14 w-full text-base" disabled={!canSubmit} onClick={submit}>
        {mutation.isPending && <Spinner />}
        {t("submit")}
      </Button>
    </div>
  );
}
