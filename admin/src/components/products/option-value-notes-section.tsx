"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "@organza/shared/constants/languages";
import { OPTION_VALUE_NOTE_MAX_LENGTH } from "@organza/shared/constants/optionValueNote";
import { LOCALE_LABELS } from "@/constants/locale";
import { countNotes, noteFor, type OptionValueNoteMap } from "@/lib/option-value-notes";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { I18nFormValue, OptionValueNoteGroup } from "@/types/productForm";

interface OptionValueNotesSectionProps {
  groups: OptionValueNoteGroup[];
  notes: OptionValueNoteMap;
  onChange: (key: string, language: keyof I18nFormValue, text: string) => void;
  disabled?: boolean;
  /** Shown under the title when some rows cannot take a note yet. */
  hint?: string;
}

// What a size, a colour or a number MEANS on this product (spec.md "Notes on
// a product's options") — "S" is a different measurement on trousers than on
// an abaya, so the shop writes it down against this product's own S.
//
// Deliberately quiet: the form already asks about prices, stock, photos,
// barcodes and several variant types, and a note is an optional aside on one
// value. So it is one collapsed block that says how many notes exist, opens
// to a plain list of "value → one line", and never grows a card of its own
// per value.
//
// ONE language switch for the whole block rather than three tabs per row: a
// product with a dozen sizes would otherwise carry thirty-six inputs and a
// phone would show almost none of them.
export function OptionValueNotesSection({
  groups,
  notes,
  onChange,
  disabled,
  hint,
}: OptionValueNotesSectionProps) {
  const t = useTranslations("products.form.optionNotes");
  const written = countNotes(notes);
  // Open on a product that already has notes — somebody is coming back to
  // read or fix one — and closed on a product that has none, where it is an
  // offer rather than a task.
  const [open, setOpen] = useState(written > 0);

  if (groups.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 p-3 text-start"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium text-foreground">{t("title")}</span>
          <span className="truncate text-xs text-muted-foreground">
            {written > 0 ? t("countWritten", { count: written }) : t("subtitle")}
          </span>
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t border-border p-3">
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

          <Tabs defaultValue={DEFAULT_LANGUAGE}>
            <TabsList>
              {SUPPORTED_LANGUAGES.map((language) => (
                <TabsTrigger key={language} value={language}>
                  {LOCALE_LABELS[language]}
                </TabsTrigger>
              ))}
            </TabsList>

            {SUPPORTED_LANGUAGES.map((language) => (
              <TabsContent key={language} value={language} className="flex flex-col gap-4">
                {groups.map((group) => (
                  <div key={group.id} className="flex flex-col gap-2">
                    {group.typeName && (
                      <p className="text-xs font-medium text-muted-foreground">{group.typeName}</p>
                    )}
                    {group.rows.map((row) => {
                      const id = `option-note-${language}-${row.key}`;
                      return (
                        // The value first and the note second, on a phone as
                        // a stacked pair and side by side once there is room:
                        // the note is the aside, never the heading.
                        <div key={row.key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <label
                            htmlFor={id}
                            className="text-sm font-medium text-foreground sm:w-28 sm:shrink-0 sm:truncate"
                          >
                            {row.label}
                          </label>
                          <Input
                            id={id}
                            value={noteFor(notes, row.key)[language]}
                            onChange={(event) => onChange(row.key, language, event.target.value)}
                            placeholder={t("placeholder")}
                            maxLength={OPTION_VALUE_NOTE_MAX_LENGTH}
                            disabled={disabled}
                            className="sm:flex-1"
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}
    </div>
  );
}
