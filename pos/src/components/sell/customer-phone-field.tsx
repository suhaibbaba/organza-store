"use client";

import { useTranslations } from "next-intl";
import { History } from "lucide-react";
import { PhoneCountryProvider, PhoneInput, Spinner } from "@store/ui";
import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES, type PhoneCountry } from "@store/ui/lib/support/phone";
import type { CustomerSuggestion } from "@organza/shared/types/order";
import { fieldTestSelector } from "@organza/shared/lib/testSelector";
import { useCustomerSuggestions } from "@/hooks/use-customer-suggestions";
import { useSettingsQuery } from "@/hooks/use-settings";

interface ShopPhoneInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  invalid: boolean;
}

function countryForDial(dial: string | undefined): PhoneCountry {
  return PHONE_COUNTRIES.find((entry) => entry.dial === dial)?.country ?? DEFAULT_PHONE_COUNTRY;
}

// The form's convention is "" for no number; PhoneInput's is null. The default prefix comes from Settings.
export function ShopPhoneInput({ id, value, onChange, onBlur, invalid }: ShopPhoneInputProps) {
  const { data: settings } = useSettingsQuery();

  return (
    <PhoneCountryProvider country={countryForDial(settings?.defaultCountryCode)}>
      <PhoneInput
        id={id}
        data-testid={fieldTestSelector(id)}
        value={value || null}
        onChange={(next) => onChange(next ?? "")}
        onBlur={onBlur}
        hasError={invalid}
        className="[&_[data-part=input]]:h-12"
      />
    </PhoneCountryProvider>
  );
}

interface CustomerPhoneFieldProps extends ShopPhoneInputProps {
  onPickSuggestion: (suggestion: CustomerSuggestion) => void;
}

// The phone box plus past orders with the same number (no Customer table yet): tapping one fills the rest of the form.
export function CustomerPhoneField({ onPickSuggestion, ...field }: CustomerPhoneFieldProps) {
  const t = useTranslations("sell.whatsapp.customer");
  const { suggestions, isLooking } = useCustomerSuggestions(field.value);

  // A suggestion already taken is the field's value; offering it back is just in the way.
  const offered = suggestions.filter((suggestion) => suggestion.phone !== field.value);

  return (
    <div className="flex flex-col gap-2">
      <ShopPhoneInput {...field} />

      {isLooking && (
        <p className="flex items-center gap-2 text-label text-ink-muted">
          <Spinner />
          {t("searching")}
        </p>
      )}

      {offered.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-micro text-ink-muted">{t("suggestionsHint")}</p>
          <ul className="flex flex-col gap-2">
            {offered.map((suggestion) => (
              <li key={suggestion.phone}>
                <button
                  type="button"
                  onClick={() => onPickSuggestion(suggestion)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-control border border-line-strong bg-surface px-4 py-3 text-start transition-colors hover:bg-row-hover focus-visible:bg-neutral-200 focus-visible:text-ink"
                >
                  <History className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />
                  <span className="flex min-w-0 flex-col">
                    <span dir="ltr" className="truncate text-value font-semibold tabular-nums text-ink">
                      {suggestion.phone}
                    </span>
                    <span className="truncate text-label text-ink-muted">
                      {suggestion.name ?? t("unnamedCustomer")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
