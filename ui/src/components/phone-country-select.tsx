import { PHONE_COUNTRIES, type PhoneCountry } from "@ui/lib/support";
import { useMemo, type JSX } from "react";
import { Flag } from "@ui/components/flag";
import { Select } from "@ui/components/select";
import type { TestIdProps } from "@ui/lib/testid";

export function PhoneCountrySelect({
  country,
  onChange,
  language,
  label,
  disabled,
  hasError,
  "data-testid": testId,
}: {
  readonly country: PhoneCountry;
  readonly onChange: (country: PhoneCountry) => void;
  readonly language: string;
  readonly label: string;
  readonly disabled?: boolean | undefined;
  readonly hasError?: boolean | undefined;
} & TestIdProps): JSX.Element {
  const names = useMemo(() => new Intl.DisplayNames([language], { type: "region" }), [language]);

  return (
    <Select
      bare
      listClassName="w-auto min-w-64"
      {...(testId !== undefined && { "data-testid": testId })}
      aria-label={label}
      value={country}
      disabled={disabled}
      hasError={hasError}
      options={PHONE_COUNTRIES.map((entry) => ({
        value: entry.country,
        label: `${names.of(entry.country) ?? entry.country} \u2066${entry.dial}\u2069`,
        icon: <Flag country={entry.country} />,
      }))}
      renderValue={(option) => {
        const entry = PHONE_COUNTRIES.find((item) => item.country === option.value);

        return entry ? (
          <span className="tabular-nums" dir="ltr">
            {entry.dial}
          </span>
        ) : null;
      }}
      onChange={(event) => {
        const next = PHONE_COUNTRIES.find((entry) => entry.country === event.target.value);

        if (next) {
          onChange(next.country);
        }
      }}
    />
  );
}
