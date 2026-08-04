"use client";

import * as React from "react";
import { PALESTINE_PHONE_PREFIXES } from "@shared/constants/phone";
import { splitE164 } from "@shared/lib/phone";
import { NumericInput } from "@/components/ui/numeric-input";
import { Select } from "@/components/ui/select";

interface PhoneFieldProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  defaultCountryCode?: string;
  disabled?: boolean;
  ariaInvalid?: boolean;
  prefixAriaLabel: string;
  placeholder?: string;
  inputClassName?: string;
}

interface PhoneParts {
  prefix: string;
  national: string;
}

// A number filled in from a past order can carry any prefix the shop has ever
// written down, not just the two local ones, so an unrecognised prefix is
// kept and offered as an extra option rather than silently dropped — that
// drop would rewrite the number, which is exactly what CLAUDE.md rule 18
// forbids.
function splitPhone(value: string, fallbackPrefix: string): PhoneParts {
  return splitE164(value) ?? { prefix: fallbackPrefix, national: "" };
}

function prefixOptions(prefix: string): string[] {
  return PALESTINE_PHONE_PREFIXES.includes(prefix) ? PALESTINE_PHONE_PREFIXES : [...PALESTINE_PHONE_PREFIXES, prefix];
}

// Composes a country-code Select with a digits-only NumericInput into a
// single E.164 value (CLAUDE.md rule 18: stored/sent exactly as entered,
// never rewritten). Mirrors admin/src/components/ui/phone-field.tsx.
export function PhoneField({
  id,
  name,
  value,
  onChange,
  onBlur,
  defaultCountryCode = PALESTINE_PHONE_PREFIXES[0],
  disabled,
  ariaInvalid,
  prefixAriaLabel,
  placeholder,
  inputClassName,
}: PhoneFieldProps) {
  const [parts, setParts] = React.useState<PhoneParts>(() => splitPhone(value, defaultCountryCode));

  // The form stays mounted across orders, and tapping a suggestion rewrites
  // the value from outside, so the internal split must re-sync whenever the
  // external value changes. Adjusted during render (React's documented
  // pattern for "resetting state when a prop changes") instead of in an
  // effect, which would setState after an extra render and flicker the old
  // number for a frame.
  const [syncedValue, setSyncedValue] = React.useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setParts(splitPhone(value, defaultCountryCode));
  }

  function emit(next: PhoneParts) {
    setParts(next);
    // An empty national part means "no number", not "just a prefix" — the
    // validator would otherwise reject a bare "+970" the cashier never typed.
    onChange(next.national ? `${next.prefix}${next.national}` : "");
  }

  return (
    <div className="flex gap-2">
      <Select
        aria-label={prefixAriaLabel}
        dir="ltr"
        className="w-24 shrink-0 text-end"
        value={parts.prefix}
        disabled={disabled}
        onChange={(e) => emit({ ...parts, prefix: e.target.value })}
      >
        {prefixOptions(parts.prefix).map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>
      <NumericInput
        id={id}
        name={name}
        // A phone number is Latin digits: pinned LTR so it reads left-to-right
        // inside the Arabic (RTL) form, but aligned to the start so the caret
        // sits where typing begins.
        dir="ltr"
        className={inputClassName ?? "flex-1 text-start"}
        value={parts.national}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => emit({ ...parts, national: e.target.value })}
        onBlur={onBlur}
      />
    </div>
  );
}
