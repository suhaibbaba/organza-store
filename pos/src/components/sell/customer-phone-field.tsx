"use client";

import { useTranslations } from "next-intl";
import { History } from "lucide-react";
import type { CustomerSuggestion } from "@shared/types/order";
import { useCustomerSuggestions } from "@/hooks/use-customer-suggestions";
import { useSettingsQuery } from "@/hooks/use-settings";
import { PhoneField } from "@/components/ui/phone-field";
import { Spinner } from "@/components/ui/spinner";

interface CustomerPhoneFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  invalid: boolean;
  onPickSuggestion: (suggestion: CustomerSuggestion) => void;
}

// The phone box, plus "have we served this number before?" underneath it.
//
// Repeat customers are the normal case for WhatsApp orders, and there is no
// Customer table to pick from (spec.md "Customer information") — so the shop's
// own past orders stand in for one. Matches appear as the number is typed;
// tapping one fills the rest of the form, and typing straight through it
// still works, because a suggestion is an offer rather than a mode.
export function CustomerPhoneField({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  onPickSuggestion,
}: CustomerPhoneFieldProps) {
  const t = useTranslations("sell.whatsapp.customer");
  const { data: settings } = useSettingsQuery();
  const { suggestions, isLooking } = useCustomerSuggestions(value);

  // Once a suggestion has been taken (or the whole number typed out), it is
  // the field's value — offering it back is just a row in the way of the
  // address box.
  const offered = suggestions.filter((suggestion) => suggestion.phone !== value);

  return (
    <div className="flex flex-col gap-2">
      <PhoneField
        id={id}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        defaultCountryCode={settings?.defaultCountryCode}
        ariaInvalid={invalid}
        prefixAriaLabel={t("phonePrefixLabel")}
      />

      {isLooking && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          {t("searching")}
        </p>
      )}

      {offered.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{t("suggestionsHint")}</p>
          <ul className="flex flex-col gap-2">
            {offered.map((suggestion) => (
              <li key={suggestion.phone}>
                <button
                  type="button"
                  onClick={() => onPickSuggestion(suggestion)}
                  className="flex w-full items-center gap-3 rounded-lg border border-input bg-background px-4 py-3 text-start transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <History className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="flex min-w-0 flex-col">
                    {/* The number leads, because that is what is being typed
                        and compared; the name sits under it as the
                        confirmation that this is the right person. Latin
                        digits pinned LTR inside the RTL form. */}
                    <span dir="ltr" className="truncate text-base font-semibold tabular-nums">
                      {suggestion.phone}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
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
