"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, CircleAlert, Minus, Plus } from "lucide-react";
import type { InventoryItem } from "@organza/shared/types/inventory";
import { QUANTITY_MAX, QUANTITY_MAX_LENGTH, QUANTITY_MIN, clampQuantity } from "@organza/shared/constants/quantity";
import { NumericInput } from "@/components/ui/numeric-input";
import { Spinner } from "@/components/ui/spinner";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import { useTranslateError } from "@/hooks/use-translate-error";
import { cn } from "@/lib/utils";
import type { StockEdit } from "@/types/inventory";

interface StockStepperProps {
  item: InventoryItem;
  /** The quantity to show: the draft while one is in flight, the server's otherwise. */
  stock: number;
  /** What the save is doing, or null when there is nothing outstanding. */
  edit: StockEdit | null;
  onChange: (item: InventoryItem, next: number) => void;
}

// Big +/- taps move the number at once and the run of them is saved as one
// change a moment after the finger stops (hooks/use-stock-edits.ts). Typing an
// exact quantity still takes an explicit Save, because a typed figure is a
// replacement rather than a nudge and deserves to be confirmed.
//
// Nothing here is disabled while a save is in flight: being able to keep
// pressing IS the feature — the presses collapse into one request rather than
// queueing behind each other.
export function StockStepper({ item, stock, edit, onChange }: StockStepperProps) {
  const t = useTranslations("inventory.stepper");
  const translateError = useTranslateError();
  const [editValue, setEditValue] = useState<string | null>(null);

  function saveEdit() {
    if (editValue === null) return;
    if (isNonNegativeIntegerString(editValue)) onChange(item, clampQuantity(Number(editValue)));
    setEditValue(null);
  }

  if (editValue !== null) {
    return (
      <div className="flex items-center gap-2">
        {/* No autoFocus: the keyboard comes up when the box is tapped, not
            when it appears. On a phone it covers the rows underneath, and
            revealing a field is not the same as asking to type in it. */}
        <NumericInput
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          maxLength={QUANTITY_MAX_LENGTH}
          className="h-11 w-20 px-2 text-center"
          aria-label={t("quantity")}
        />
        <button
          type="button"
          onClick={saveEdit}
          aria-label={t("save")}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
        >
          <Check className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setEditValue(null)}
          className="shrink-0 px-1 text-xs font-medium text-muted-foreground"
        >
          {t("cancel")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(item, stock - 1)}
          disabled={stock <= QUANTITY_MIN}
          aria-label={t("decrease")}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-input text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => setEditValue(String(stock))}
          aria-label={t("edit")}
          className="flex min-w-11 shrink-0 items-center justify-center rounded-lg px-1 text-base font-semibold text-foreground"
        >
          {stock}
        </button>

        <button
          type="button"
          onClick={() => onChange(item, stock + 1)}
          disabled={stock >= QUANTITY_MAX}
          aria-label={t("increase")}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-input text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Three states, never two at once, and each says the quantity it is
          talking about — the row may by now be marked as no longer matching
          the filter, and "saved" on its own would leave the user guessing
          which number was saved. Announced politely so the confirmation is
          not only a colour. */}
      {edit && (
        <span role="status" aria-live="polite" className="text-end text-xs font-medium">
          {edit.status === "saved" ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="size-3.5 shrink-0" aria-hidden="true" />
              {t("savedValue", { count: edit.value })}
            </span>
          ) : edit.status === "error" ? (
            <span className="inline-flex max-w-48 items-start gap-1 text-destructive">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {translateError(edit.errorCode ?? "error.internal")} {t("revertedTo", { count: edit.value })}
              </span>
            </span>
          ) : (
            <span className={cn("inline-flex items-center gap-1 text-muted-foreground")}>
              {edit.status === "saving" ? (
                <Spinner className="size-3.5" />
              ) : (
                <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
              )}
              {edit.status === "saving" ? t("saving") : t("unsaved")}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
