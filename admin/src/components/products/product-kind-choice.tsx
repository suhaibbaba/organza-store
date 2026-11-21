"use client";

import { useState } from "react";
import { Hash, Shirt } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert } from "@store/ui";
import { cn } from "@/lib/utils";

interface ProductKindChoiceProps {
  // true = a numbered product (spec.md "Numbered shawls"): one photo, each number its own piece.
  value: boolean;
  onChange: (isNumbered: boolean) => void;
  // Saved options/numbers lock the kind (the API refuses the switch); nothing is ever deleted to allow it.
  lockedReason: "options" | "numbers" | null;
  disabled?: boolean;
}

export function ProductKindChoice({ value, onChange, lockedReason, disabled }: ProductKindChoiceProps) {
  const t = useTranslations("products.form.kind");
  const [showLockWarning, setShowLockWarning] = useState(false);

  function choose(next: boolean) {
    if (next === value) return;
    // Locked: say why, and leave the saved answer exactly as it is.
    if (lockedReason) {
      setShowLockWarning(true);
      return;
    }
    setShowLockWarning(false);
    onChange(next);
  }

  const options = [
    {
      isNumbered: false,
      Icon: Shirt,
      title: t("ordinaryTitle"),
      description: t("ordinaryDescription"),
    },
    {
      isNumbered: true,
      Icon: Hash,
      title: t("numberedTitle"),
      description: t("numberedDescription"),
    },
  ];

  return (
    <div className="flex flex-col gap-3">

      <div role="radiogroup" aria-label={t("legend")} className="flex flex-col gap-3 sm:flex-row">
        {options.map((option) => {
          const selected = option.isNumbered === value;
          return (
            <button
              key={String(option.isNumbered)}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => choose(option.isNumbered)}
              className={cn(
                "flex min-h-24 flex-1 flex-col items-start gap-1 rounded-panel border p-4 text-start transition-colors",
                "focus-darken",
                "disabled:cursor-not-allowed disabled:opacity-50",
                selected ? "bg-selected border-selected-line" : "border-line bg-surface not-disabled:hover:bg-row-hover"
              )}
            >
              <span className="flex items-center gap-2 text-value font-medium text-ink">
                <option.Icon className="size-5 shrink-0" aria-hidden="true" />
                {option.title}
              </span>
              <span className="text-label text-ink-muted">{option.description}</span>
            </button>
          );
        })}
      </div>

      {showLockWarning && lockedReason && (
        <Alert tone="danger">
          {lockedReason === "numbers" ? t("lockedByNumbers") : t("lockedByOptions")}
        </Alert>
      )}
    </div>
  );
}
