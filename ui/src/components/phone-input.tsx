import { DEFAULT_PHONE_COUNTRY, foldDigits, joinPhone, splitPhone, type PhoneCountry } from "@ui/lib/support";
import { createContext, useContext, useEffect, useState, type JSX, type ReactNode } from "react";
import { useTranslation } from "@ui/lib/i18n";
import { Input, type InputProps } from "@ui/components/input";
import { PhoneCountrySelect } from "@ui/components/phone-country-select";
import { cn } from "@ui/lib/cn";
import type { TestIdProps } from "@ui/lib/testid";

const PhoneCountryContext = createContext<PhoneCountry>(DEFAULT_PHONE_COUNTRY);

export function PhoneCountryProvider({
  country,
  children,
}: {
  readonly country: PhoneCountry;
  readonly children: ReactNode;
}): JSX.Element {
  return <PhoneCountryContext.Provider value={country}>{children}</PhoneCountryContext.Provider>;
}

export interface PhoneInputProps
  extends Omit<InputProps, "type" | "inputMode" | "dir" | "value" | "defaultValue" | "onChange">, TestIdProps {
  readonly value: string | null | undefined;
  readonly onChange: (value: string | null) => void;
}

const phoneCharacters = (value: string): string =>
  foldDigits(value)
    .replace(/[^\d\s+-]/g, "")
    .replace(/(?!^)\+/g, "");

export function PhoneInput({
  value,
  onChange,
  onBlur,
  hasError,
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
  "data-testid": testId,
  ...props
}: PhoneInputProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const fallback = useContext(PhoneCountryContext);

  const [country, setCountry] = useState<PhoneCountry>(() => splitPhone(value, fallback).country);
  const [local, setLocal] = useState(() => splitPhone(value, fallback).local);

  useEffect(() => {
    if (joinPhone(country, local) !== (value ?? null)) {
      const next = splitPhone(value, fallback);

      setCountry(next.country);
      setLocal(next.local);
    }
  }, [value, fallback]);

  const emit = (nextCountry: PhoneCountry, nextLocal: string): void => {
    setCountry(nextCountry);
    setLocal(nextLocal);
    onChange(joinPhone(nextCountry, nextLocal));
  };

  return (
    <div data-part="phone-input" dir="ltr" className={cn("flex", className)}>
      <Input
        {...props}
        leading={
          <PhoneCountrySelect
            {...(testId !== undefined && { "data-testid": `${testId}-country` })}
            label={t("ui.common.diallingCode")}
            language={i18n.language}
            country={country}
            disabled={disabled}
            hasError={hasError}
            onChange={(next) => emit(next, local)}
          />
        }
        id={id}
        {...(testId !== undefined && { "data-testid": testId })}
        aria-label={ariaLabel}
        type="tel"
        dir="ltr"
        inputMode="tel"
        autoComplete="tel-national"
        className="min-w-0 flex-1 tabular-nums"
        hasError={hasError}
        disabled={disabled}
        value={local}
        onBlur={onBlur}
        onChange={(event) => emit(country, phoneCharacters(event.target.value))}
      />
    </div>
  );
}
