"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Spinner } from "@store/ui";
import { Check, CircleAlert, Minus, Plus } from "lucide-react";
import type { InventoryItem } from "@organza/shared/types/inventory";
import { QUANTITY_MAX, QUANTITY_MAX_LENGTH, QUANTITY_MIN, clampQuantity } from "@organza/shared/constants/quantity";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { NumericInput } from "@/components/fields/numeric-input";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import { useTranslateError } from "@/hooks/use-translate-error";
import type { StockEdit } from "@/types/inventory";

interface StockStepperProps {
  item: InventoryItem;
  /** The quantity to show: the draft while one is in flight, the server's otherwise. */
  stock: number;
  /** What the save is doing, or null when there is nothing outstanding. */
  edit: StockEdit | null;
  onChange: (item: InventoryItem, next: number) => void;
}

// +/- presses collapse into one debounced save and are never disabled mid-save; a typed figure is a replacement and needs an explicit Save.
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
        {/* No autoFocus: on a phone the keyboard would cover the rows underneath. */}
        <NumericInput
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          maxLength={QUANTITY_MAX_LENGTH}
          className="h-11 w-20 px-2 text-center"
          aria-label={t("quantity")}
          data-test-selector={testSelectorFor("stock-input", item.id)}
        />
        <button
          type="button"
          onClick={saveEdit}
          aria-label={t("save")}
          data-test-selector={testSelectorFor("stock-save", item.id)}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-primary-600 text-ink-inverse hover:bg-primary-700 active:bg-primary-800"
        >
          <Check className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setEditValue(null)}
          className="shrink-0 px-1 text-meta font-medium text-ink-muted"
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
          data-test-selector={testSelectorFor("stock-decrease", item.id)}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-control border border-line-strong bg-surface text-ink hover:bg-inset disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => setEditValue(String(stock))}
          aria-label={t("edit")}
          data-test-selector={testSelectorFor("stock-value", item.id)}
          className="flex min-w-11 shrink-0 items-center justify-center rounded-control px-1 text-value font-semibold text-ink hover:bg-inset"
        >
          {stock}
        </button>

        <button
          type="button"
          onClick={() => onChange(item, stock + 1)}
          disabled={stock >= QUANTITY_MAX}
          aria-label={t("increase")}
          data-test-selector={testSelectorFor("stock-increase", item.id)}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-control border border-line-strong bg-surface text-ink hover:bg-inset disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Each state names the quantity it means, since the row may already have left the filter. */}
      {edit && (
        <span role="status" aria-live="polite" className="text-end text-meta font-medium">
          {edit.status === "saved" ? (
            <span className="inline-flex items-center gap-1 text-success-700">
              <Check className="size-3.5 shrink-0" aria-hidden="true" />
              {t("savedValue", { count: edit.value })}
            </span>
          ) : edit.status === "error" ? (
            <span className="inline-flex max-w-48 items-start gap-1 text-danger-600">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {translateError(edit.errorCode ?? "error.internal")} {t("revertedTo", { count: edit.value })}
              </span>
            </span>
          ) : (
            <span className={"inline-flex items-center gap-1 text-ink-muted"}>
              {edit.status === "saving" ? (
                <Spinner className="size-3.5" />
              ) : (
                <span className="size-1.5 shrink-0 rounded-pill bg-warning-500" aria-hidden="true" />
              )}
              {edit.status === "saving" ? t("saving") : t("unsaved")}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
