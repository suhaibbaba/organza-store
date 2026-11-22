"use client";

import { useTranslations } from "next-intl";
import { History } from "lucide-react";
import { CardButton, PhoneCountryProvider, PhoneInput, Spinner, Typography } from "@store/ui";
import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES, type PhoneCountry } from "@store/ui/lib/support/phone";
import type { CustomerSuggestion } from "@store/shared/types/order";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
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
        <div className="flex items-center gap-2">
          <Spinner />
          <Typography as="span" variant="small" tone="muted">
            {t("searching")}
          </Typography>
        </div>
      )}

      {offered.length > 0 && (
        <div className="flex flex-col gap-2">
          <Typography variant="caption" tone="muted">
            {t("suggestionsHint")}
          </Typography>
          <ul className="flex flex-col gap-2">
            {offered.map((suggestion) => (
              <li key={suggestion.phone}>
                <CardButton
                  onClick={() => onPickSuggestion(suggestion)}
                  className="items-center gap-3 px-4 py-3 focus-darken"
                >
                  <History className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />
                  <span className="flex min-w-0 flex-col items-start">
                    <Typography as="span" variant="body" weight="semibold" dir="ltr" className="truncate tabular-nums">
                      {suggestion.phone}
                    </Typography>
                    <Typography as="span" variant="small" tone="muted" className="truncate">
                      {suggestion.name ?? t("unnamedCustomer")}
                    </Typography>
                  </span>
                </CardButton>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
