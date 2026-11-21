"use client";

import { Controller, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue } from "react-hook-form";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { Card, FormField, Input, PhoneCountryProvider, PhoneInput, Textarea } from "@store/ui";
import { splitPhone } from "@store/ui/lib/support/phone";
import { fieldErrorTestSelector, fieldTestSelector } from "@organza/shared/lib/testSelector";
import { SIGNED_DECIMAL_INPUT_PATTERN } from "@/constants/numeric";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useTranslateError } from "@/hooks/use-translate-error";
import { splitCoordinatePair, type OrderCustomerFormValues } from "@/lib/validation/order-form";

interface CustomerFormProps {
  register: UseFormRegister<OrderCustomerFormValues>;
  control: Control<OrderCustomerFormValues>;
  setValue: UseFormSetValue<OrderCustomerFormValues>;
  errors: FieldErrors<OrderCustomerFormValues>;
}

function FieldMessage({ field, children }: { field: string; children: string }) {
  return (
    <p className="text-meta text-danger-600" role="alert" data-test-selector={fieldErrorTestSelector(field)}>
      {children}
    </p>
  );
}

// Snapshotted onto the order (no Customer entity yet, spec.md "Customer information"), so typed per order.
export function CustomerForm({ register, control, setValue, errors }: CustomerFormProps) {
  const t = useTranslations("orders.new.customer");
  const translateError = useTranslateError();
  const { data: settings } = useSettingsQuery();
  const defaultCountry = splitPhone(settings?.defaultCountryCode).country;

  // A WhatsApp location share is one "32.313, 35.028" string; pasting it into latitude fills both fields.
  function handleLatitudeChange(value: string) {
    const pair = splitCoordinatePair(value);
    if (!pair) return;
    setValue("latitude", pair.latitude, { shouldValidate: true });
    setValue("longitude", pair.longitude, { shouldValidate: true });
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-section font-medium text-ink">{t("title")}</h2>

      <FormField label="orders.new.customer.name" htmlFor="customer-name">
        <Input
          id="customer-name"
          data-test-selector={fieldTestSelector("customer-name")}
          hasError={!!errors.name}
          {...register("name")}
        />
        {errors.name && <FieldMessage field="customer-name">{translateError(errors.name.message ?? "")}</FieldMessage>}
      </FormField>

      <PhoneCountryProvider country={defaultCountry}>
        <FormField label="orders.new.customer.phone" htmlFor="customer-phone">
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <PhoneInput
                id="customer-phone"
                data-test-selector={fieldTestSelector("customer-phone")}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "")}
                onBlur={field.onBlur}
                hasError={!!errors.phone}
              />
            )}
          />
          {errors.phone && (
            <FieldMessage field="customer-phone">{translateError(errors.phone.message ?? "")}</FieldMessage>
          )}
        </FormField>

        <FormField label="orders.new.customer.whatsapp" htmlFor="customer-whatsapp">
          <Controller
            control={control}
            name="whatsapp"
            render={({ field }) => (
              <PhoneInput
                id="customer-whatsapp"
                data-test-selector={fieldTestSelector("customer-whatsapp")}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "")}
                onBlur={field.onBlur}
                hasError={!!errors.whatsapp}
              />
            )}
          />
          {errors.whatsapp ? (
            <FieldMessage field="customer-whatsapp">{translateError(errors.whatsapp.message ?? "")}</FieldMessage>
          ) : (
            <p className="text-meta text-ink-muted">{t("whatsappHint")}</p>
          )}
        </FormField>
      </PhoneCountryProvider>

      <FormField label="orders.new.customer.address" htmlFor="customer-address">
        <Textarea
          id="customer-address"
          data-test-selector={fieldTestSelector("customer-address")}
          placeholder={t("addressPlaceholder")}
          {...register("address")}
        />
      </FormField>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="flex items-center gap-1.5 text-label text-ink">
          <MapPin className="size-4" aria-hidden="true" />
          {t("location")}
        </legend>
        <p className="text-meta text-ink-muted">{t("locationHint")}</p>
        <div className="flex flex-col gap-2">
          {/* Coordinates may be negative decimals: a decimal keypad, LTR so the minus stays in front. */}
          <Input
            type="text"
            inputMode="decimal"
            pattern={SIGNED_DECIMAL_INPUT_PATTERN}
            dir="ltr"
            data-test-selector="field-latitude"
            placeholder={t("latitude")}
            aria-label={t("latitude")}
            hasError={!!errors.latitude}
            {...register("latitude", { onChange: (event) => handleLatitudeChange(event.target.value) })}
          />
          <Input
            type="text"
            inputMode="decimal"
            pattern={SIGNED_DECIMAL_INPUT_PATTERN}
            dir="ltr"
            data-test-selector="field-longitude"
            placeholder={t("longitude")}
            aria-label={t("longitude")}
            hasError={!!errors.longitude}
            {...register("longitude")}
          />
        </div>
        {(errors.latitude || errors.longitude) && (
          <FieldMessage field="coordinates">
            {translateError((errors.latitude?.message ?? errors.longitude?.message) ?? "")}
          </FieldMessage>
        )}
      </fieldset>

      <FormField label="orders.new.customer.note" htmlFor="customer-note">
        <Textarea
          id="customer-note"
          data-test-selector={fieldTestSelector("customer-note")}
          placeholder={t("notePlaceholder")}
          {...register("note")}
        />
      </FormField>
    </Card>
  );
}
