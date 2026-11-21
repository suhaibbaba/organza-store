"use client";

import { useLocale } from "next-intl";
import { variantValueNotes } from "@store/shared/lib/optionValueNotes";
import type { Variant } from "@store/shared/types/variant";
import { localize } from "@/lib/i18n-content";
import { cn } from "@/lib/utils";

interface VariantNotesProps {
  variant: Variant;
  className?: string;
}

// What an option value means on THIS product (spec.md "Notes on a product's options"), prefixed by the value only when there are several.
export function VariantNotes({ variant, className }: VariantNotesProps) {
  const locale = useLocale();
  const notes = variantValueNotes(variant);
  if (notes.length === 0) return null;

  const showValueLabels = notes.length > 1;

  return (
    <ul className={cn("flex w-full flex-col gap-0.5", className)}>
      {notes.map((entry) => (
        <li key={entry.valueId} className="line-clamp-2 text-micro text-ink-muted">
          {showValueLabels && (
            <span className="font-medium text-ink/80">{localize(entry.value, locale)}: </span>
          )}
          {localize(entry.note, locale)}
        </li>
      ))}
    </ul>
  );
}
