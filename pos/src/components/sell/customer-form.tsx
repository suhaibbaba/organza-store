"use client";

import { Controller, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue } from "react-hook-form";
import { useTranslations } from "next-intl";
import { ChevronDown, MapPin } from "lucide-react";
import type { CustomerSuggestion } from "@shared/types/order";
import { SIGNED_DECIMAL_INPUT_PATTERN } from "@/constants/numeric";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useTranslateError } from "@/hooks/use-translate-error";
import { splitCoordinatePair, type OrderCustomerFormValues } from "@/lib/validation/customer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneField } from "@/components/ui/phone-field";
import { CustomerPhoneField } from "@/components/sell/customer-phone-field";

interface CustomerFormProps {
  register: UseFormRegister<OrderCustomerFormValues>;
  control: Control<OrderCustomerFormValues>;
  setValue: UseFormSetValue<OrderCustomerFormValues>;
  errors: FieldErrors<OrderCustomerFormValues>;
  onPickSuggestion: (suggestion: CustomerSuggestion) => void;
}

// Who the order goes to. Snapshotted onto the order itself — there is no
// Customer entity yet (spec.md "Customer information").
//
// Only the three things a delivery actually needs are on screen: a name, a
// number, and where it goes. Everything else is optional and folded away, so
// the common order is three fields and a button rather than a form to work
// through (CLAUDE.md "Few, clear steps").
export function CustomerForm({ register, control, setValue, errors, onPickSuggestion }: CustomerFormProps) {
  const t = useTranslations("sell.whatsapp.customer");
  const translateError = useTranslateError();
  const { data: settings } = useSettingsQuery();

  // A WhatsApp location share is one "32.313, 35.028" string. Pasting it into
  // the latitude box fills both fields instead of failing validation — that
  // paste is exactly how these coordinates reach the shop.
  function handleLatitudeChange(value: string) {
    const pair = splitCoordinatePair(value);
    if (!pair) return;
    setValue("latitude", pair.latitude, { shouldValidate: true });
    setValue("longitude", pair.longitude, { shouldValidate: true });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="customer-name">{t("name")}</Label>
        <Input
          id="customer-name"
          autoComplete="off"
          aria-invalid={!!errors.name}
          placeholder={t("namePlaceholder")}
          {...register("name")}
        />
        {errors.name && <p className="text-sm text-destructive">{translateError(errors.name.message ?? "")}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="customer-phone">{t("phone")}</Label>
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <CustomerPhoneField
              id="customer-phone"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              invalid={!!errors.phone}
              onPickSuggestion={onPickSuggestion}
            />
          )}
        />
        {errors.phone && <p className="text-sm text-destructive">{translateError(errors.phone.message ?? "")}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="customer-address">{t("address")}</Label>
        <Textarea id="customer-address" placeholder={t("addressPlaceholder")} {...register("address")} />
      </div>

      {/* Native disclosure rather than a JS accordion: it is one tap, it
          works before hydration, and the screen reader announces it for
          free. */}
      <details className="rounded-lg border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 text-base font-medium marker:hidden [&::-webkit-details-marker]:hidden">
          {t("moreDetails")}
          <ChevronDown className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </summary>

        <div className="flex flex-col gap-5 border-t border-border p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="customer-whatsapp">{t("whatsapp")}</Label>
            <Controller
              control={control}
              name="whatsapp"
              render={({ field }) => (
                <PhoneField
                  id="customer-whatsapp"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  defaultCountryCode={settings?.defaultCountryCode}
                  ariaInvalid={!!errors.whatsapp}
                  prefixAriaLabel={t("phonePrefixLabel")}
                />
              )}
            />
            {errors.whatsapp ? (
              <p className="text-sm text-destructive">{translateError(errors.whatsapp.message ?? "")}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t("whatsappHint")}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label className="flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden="true" />
              {t("location")}
            </Label>
            <p className="text-xs text-muted-foreground">{t("locationHint")}</p>
            {/* Coordinates are Latin decimals that may be negative, so they
                use a plain decimal keypad rather than the digits-only
                NumericInput, and sit LTR so a minus sign stays in front. */}
            <Input
              type="text"
              inputMode="decimal"
              pattern={SIGNED_DECIMAL_INPUT_PATTERN}
              dir="ltr"
              placeholder={t("latitude")}
              aria-label={t("latitude")}
              aria-invalid={!!errors.latitude}
              {...register("latitude", { onChange: (event) => handleLatitudeChange(event.target.value) })}
            />
            <Input
              type="text"
              inputMode="decimal"
              pattern={SIGNED_DECIMAL_INPUT_PATTERN}
              dir="ltr"
              placeholder={t("longitude")}
              aria-label={t("longitude")}
              aria-invalid={!!errors.longitude}
              {...register("longitude")}
            />
            {(errors.latitude || errors.longitude) && (
              <p className="text-sm text-destructive">
                {translateError(errors.latitude?.message ?? errors.longitude?.message ?? "")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="customer-note">{t("note")}</Label>
            <Textarea id="customer-note" placeholder={t("notePlaceholder")} {...register("note")} />
          </div>
        </div>
      </details>
    </div>
  );
}
