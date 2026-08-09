"use client";

import { useState } from "react";
import { Hash, Shirt } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface ProductKindChoiceProps {
  // true = a numbered product (spec.md "Numbered shawls"): one photo, numbers
  // on it, each number its own piece. false = the ordinary kind, sold by
  // colour/size (or with no options at all).
  value: boolean;
  onChange: (isNumbered: boolean) => void;
  // The product already has options or numbers saved. Changing kind now would
  // strand every one of them (and the API refuses it), so the other choice is
  // explained instead of silently taken — nothing is ever deleted to make the
  // switch possible.
  lockedReason: "options" | "numbers" | null;
  disabled?: boolean;
}

// The first question the product form asks, because the answer decides what
// the rest of it shows. Two big cards rather than a toggle: on a phone this
// is one thumb tap either way, and each option says in plain words what it
// means for the person filling the form in.
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
      <p className="text-sm text-muted-foreground">{t("hint")}</p>

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
                "flex min-h-24 flex-1 flex-col items-start gap-1 rounded-xl border p-4 text-start transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                selected ? "border-primary bg-primary/10" : "border-border bg-card not-disabled:hover:bg-accent/60"
              )}
            >
              <span className="flex items-center gap-2 text-base font-medium text-foreground">
                <option.Icon className="size-5 shrink-0" aria-hidden="true" />
                {option.title}
              </span>
              <span className="text-sm text-muted-foreground">{option.description}</span>
            </button>
          );
        })}
      </div>

      {showLockWarning && lockedReason && (
        <Alert variant="destructive">
          {lockedReason === "numbers" ? t("lockedByNumbers") : t("lockedByOptions")}
        </Alert>
      )}
    </div>
  );
}
