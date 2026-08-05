"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Minus, Plus } from "lucide-react";
import type { InventoryItem } from "@shared/types/inventory";
import { NumericInput } from "@/components/ui/numeric-input";
import { Spinner } from "@/components/ui/spinner";
import { useAdjustStockMutation } from "@/hooks/use-inventory";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

const SUCCESS_FLASH_MS = 1500;

interface StockStepperProps {
  item: InventoryItem;
}

// Big +/- taps apply immediately (each tap is already a deliberate,
// single-unit action); typing an exact quantity requires an explicit Save
// (the "confirmation" step) before it's sent. Each row owns its own
// mutation, so pending/success/error feedback never leaks across rows.
export function StockStepper({ item }: StockStepperProps) {
  const t = useTranslations("inventory.stepper");
  const translateError = useTranslateError();
  const mutation = useAdjustStockMutation();
  const [editValue, setEditValue] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup only — the flash itself is triggered from the mutate() success
  // callback below, not from an effect reacting to mutation state.
  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  function flashSaved() {
    setShowSaved(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setShowSaved(false), SUCCESS_FLASH_MS);
  }

  function commit(stock: number) {
    if (stock < 0) return;
    mutation.mutate({ item, stock }, { onSuccess: flashSaved });
  }

  function saveEdit() {
    if (editValue === null) return;
    const parsed = Number(editValue);
    if (!Number.isInteger(parsed) || parsed < 0) return;
    commit(parsed);
    setEditValue(null);
  }

  const isPending = mutation.isPending;

  if (editValue !== null) {
    return (
      <div className="flex items-center gap-2">
        {/* No autoFocus: the keyboard comes up when the box is tapped, not
            when it appears. On a phone it covers the rows underneath, and
            revealing a field is not the same as asking to type in it. */}
        <NumericInput
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="h-11 w-20 px-2 text-center"
          aria-label={t("quantity")}
        />
        <button
          type="button"
          onClick={saveEdit}
          disabled={isPending}
          aria-label={t("save")}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
        >
          {isPending ? <Spinner className="size-4" /> : <Check className="size-5" aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={() => setEditValue(null)}
          disabled={isPending}
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
          onClick={() => commit(item.stock - 1)}
          disabled={isPending || item.stock <= 0}
          aria-label={t("decrease")}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-input text-foreground disabled:opacity-40"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => setEditValue(String(item.stock))}
          disabled={isPending}
          aria-label={t("edit")}
          className="flex min-w-11 shrink-0 items-center justify-center rounded-lg px-1 text-base font-semibold text-foreground disabled:opacity-50"
        >
          {isPending ? <Spinner className="size-4" /> : item.stock}
        </button>

        <button
          type="button"
          onClick={() => commit(item.stock + 1)}
          disabled={isPending}
          aria-label={t("increase")}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-input text-foreground disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>

      {showSaved && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t("saved")}</span>}
      {mutation.isError && (
        <span className="max-w-40 text-end text-xs text-destructive">
          {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
        </span>
      )}
    </div>
  );
}
