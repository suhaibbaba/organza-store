"use client";

import * as React from "react";
import { PALESTINE_PHONE_PREFIXES } from "@organza/shared/constants/phone";
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
}

function splitPhone(value: string, fallbackPrefix: string): { prefix: string; national: string } {
  const prefix = PALESTINE_PHONE_PREFIXES.find((p) => value.startsWith(p));
  if (prefix) return { prefix, national: value.slice(prefix.length) };
  return { prefix: fallbackPrefix, national: "" };
}

// Composes a country-code Select with a digits-only NumericInput into a
// single E.164 value (CLAUDE.md rule 18: stored/sent exactly as entered,
// never rewritten). Used for both `phone` and `whatsapp` on the staff form.
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
}: PhoneFieldProps) {
  const [prefix, setPrefix] = React.useState(() => splitPhone(value, defaultCountryCode).prefix);
  const [national, setNational] = React.useState(() => splitPhone(value, defaultCountryCode).national);

  // The sheet keeps this field mounted across create/edit targets (see
  // UserFormSheet), so internal state must re-sync whenever the form resets
  // to a new external value. Adjusted during render (React's documented
  // pattern for "resetting state when a prop changes") instead of an
  // effect, which would setState after an extra render and cause a flicker.
  const [syncedValue, setSyncedValue] = React.useState(value);
  if (value !== syncedValue) {
    const next = splitPhone(value, defaultCountryCode);
    setSyncedValue(value);
    setPrefix(next.prefix);
    setNational(next.national);
  }

  function handlePrefixChange(nextPrefix: string) {
    setPrefix(nextPrefix);
    onChange(national ? `${nextPrefix}${national}` : "");
  }

  function handleNationalChange(nextNational: string) {
    setNational(nextNational);
    onChange(nextNational ? `${prefix}${nextNational}` : "");
  }

  return (
    <div className="flex gap-2">
      <Select
        aria-label={prefixAriaLabel}
        dir="ltr"
        className="w-24 shrink-0 text-end"
        value={prefix}
        disabled={disabled}
        onChange={(e) => handlePrefixChange(e.target.value)}
      >
        {PALESTINE_PHONE_PREFIXES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>
      <NumericInput
        id={id}
        name={name}
        dir="ltr"
        className="flex-1 text-start"
        value={national}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        placeholder={placeholder}
        onChange={(e) => handleNationalChange(e.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}
