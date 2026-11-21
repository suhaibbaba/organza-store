"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { fieldTestSelector } from "@organza/shared/lib/testSelector";
import { Alert, Button, Drawer, FormField, Textarea } from "@store/ui";
import { NumericInput } from "@/components/fields/numeric-input";
import { useOpenCashSessionMutation } from "@/hooks/use-cash-sessions";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { timezoneOffsetMinutes } from "@/lib/report-range";

interface OpenDaySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Last night's count, pre-filled — that carry-over is why the withdrawal is recorded at close.
  suggestedOpeningFloat: string;
}

// The float is editable because the owner sometimes puts in a different amount by hand.
export function OpenDaySheet({ open, onOpenChange, suggestedOpeningFloat }: OpenDaySheetProps) {
  const t = useTranslations("dashboard.drawer.openDay");

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      descriptionKey="dashboard.drawer.openDay.title"
      data-testid="sheet-open-day"
    >
      {/* Keyed so each opening starts from the suggestion, not what was last abandoned. */}
      <OpenDayForm
        key={String(open)}
        suggestedOpeningFloat={suggestedOpeningFloat}
        onDone={() => onOpenChange(false)}
      />
    </Drawer>
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
    <div className="flex flex-col gap-4">
      <p className="text-label text-ink-muted">
        {t("description", { amount: formatMoney(suggestedOpeningFloat) })}
      </p>

      {mutation.isError && (
        <Alert tone="danger">
          {translateError(mutation.error instanceof ApiError ? mutation.error.code : ERROR_CODES.INTERNAL)}
        </Alert>
      )}

      <FormField label="dashboard.drawer.openDay.openingFloat" htmlFor="opening-float">
        <NumericInput
          id="opening-float"
          allowDecimal
          value={openingFloat}
          onChange={(event) => setOpeningFloat(event.target.value)}
        />
      </FormField>

      <FormField label="dashboard.drawer.openDay.note" htmlFor="open-note">
        <Textarea
          id="open-note"
          data-testid={fieldTestSelector("open-note")}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("notePlaceholder")}
        />
      </FormField>

      <Button
        type="button"
        className="w-full"
        disabled={!canSubmit}
        isLoading={mutation.isPending}
        onClick={submit}
      >
        {t("submit")}
      </Button>
    </div>
  );
}
