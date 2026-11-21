"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input, SegmentedControl } from "@store/ui";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "@organza/shared/constants/languages";
import { fieldTestSelector, testSelectorFor } from "@organza/shared/lib/testSelector";
import { OPTION_VALUE_NOTE_MAX_LENGTH } from "@organza/shared/constants/optionValueNote";
import { LOCALE_LABELS } from "@/constants/locale";
import { countNotes, noteFor, type OptionValueNoteMap } from "@/lib/option-value-notes";
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

// One language switch for the whole block, not tabs per row: a dozen sizes would otherwise be thirty-six inputs (spec.md "Notes on a product's options").
export function OptionValueNotesSection({
  groups,
  notes,
  onChange,
  disabled,
  hint,
}: OptionValueNotesSectionProps) {
  const t = useTranslations("products.form.optionNotes");
  const tCommon = useTranslations("common");
  const written = countNotes(notes);
  // Open when notes exist (someone is coming back to fix one); closed otherwise, where it's an offer, not a task.
  const [open, setOpen] = useState(written > 0);
  const [language, setLanguage] = useState<keyof I18nFormValue>(DEFAULT_LANGUAGE);

  if (groups.length === 0) return null;

  return (
    <div className="rounded-panel border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        data-test-selector="option-notes-toggle"
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-panel p-3 text-start focus-visible:bg-inset"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-label font-medium text-ink">{t("title")}</span>
          <span className="truncate text-micro text-ink-muted">
            {written > 0 ? t("countWritten", { count: written }) : t("subtitle")}
          </span>
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-ink-muted transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t border-line p-3">
          {hint && <p className="text-micro text-ink-muted">{hint}</p>}

          <SegmentedControl
            label={tCommon("language")}
            value={language}
            onChange={setLanguage}
            options={SUPPORTED_LANGUAGES.map((code) => ({ value: code, label: LOCALE_LABELS[code] }))}
          />

          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.id} className="flex flex-col gap-2">
                {group.typeName && <p className="text-micro font-medium text-ink-muted">{group.typeName}</p>}
                {group.rows.map((row) => {
                  const id = `option-note-${language}-${row.key}`;
                  return (
                    <div
                      key={row.key}
                      className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
                      data-test-selector={testSelectorFor("option-note-row", row.key)}
                    >
                      <label htmlFor={id} className="text-label text-ink sm:w-28 sm:shrink-0 sm:truncate">
                        {row.label}
                      </label>
                      <Input
                        id={id}
                        data-test-selector={fieldTestSelector(id)}
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
          </div>
        </div>
      )}
    </div>
  );
}
