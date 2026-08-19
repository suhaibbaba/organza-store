"use client";

import { useLocale } from "next-intl";
import { variantValueNotes } from "@organza/shared/lib/optionValueNotes";
import type { Variant } from "@organza/shared/types/variant";
import { localize } from "@/lib/i18n-content";
import { cn } from "@/lib/utils";

interface VariantNotesProps {
  variant: Variant;
  className?: string;
}

// What this piece's options MEAN, said where the cashier is choosing between
// them (spec.md "Notes on a product's options"): "S" is a different
// measurement on trousers than on an abaya, so the shop writes the
// measurement against that product's own S and it shows up here.
//
// Deliberately small and grey, under the name: a picker with a dozen tiles
// has to stay scannable, and the note is an aside on the tile, never its
// heading. Two lines at most each — the rest is in the product screen.
//
// A variant carrying notes from two option types (a colour note AND a size
// note) gets one line each, prefixed with the value it belongs to so it is
// obvious which is which. A single note needs no prefix: the tile is already
// showing the value it explains, and repeating it wastes the width.
//
// Nothing at all when there is no note, which is the usual case — no empty
// line, no gap, no shifted layout.
export function VariantNotes({ variant, className }: VariantNotesProps) {
  const locale = useLocale();
  const notes = variantValueNotes(variant);
  if (notes.length === 0) return null;

  const showValueLabels = notes.length > 1;

  return (
    <ul className={cn("flex w-full flex-col gap-0.5", className)}>
      {notes.map((entry) => (
        <li key={entry.valueId} className="line-clamp-2 text-xs leading-tight text-muted-foreground">
          {showValueLabels && (
            <span className="font-medium text-foreground/80">{localize(entry.value, locale)}: </span>
          )}
          {localize(entry.note, locale)}
        </li>
      ))}
    </ul>
  );
}
