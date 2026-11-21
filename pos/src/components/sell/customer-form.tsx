"use client";

import { Controller, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue } from "react-hook-form";
import { useTranslations } from "next-intl";
import { ChevronDown, MapPin } from "lucide-react";
import { FormField, Input, Textarea } from "@store/ui";
import type { CustomerSuggestion } from "@organza/shared/types/order";
import { fieldErrorTestSelector, fieldTestSelector } from "@organza/shared/lib/testSelector";
import { SIGNED_DECIMAL_INPUT_PATTERN } from "@/constants/numeric";
import { useTranslateError } from "@/hooks/use-translate-error";
import { splitCoordinatePair, type OrderCustomerFormValues } from "@/lib/validation/customer";
import { CustomerPhoneField, ShopPhoneInput } from "@/components/sell/customer-phone-field";

interface CustomerFormProps {
  register: UseFormRegister<OrderCustomerFormValues>;
  control: Control<OrderCustomerFormValues>;
  setValue: UseFormSetValue<OrderCustomerFormValues>;
  errors: FieldErrors<OrderCustomerFormValues>;
  onPickSuggestion: (suggestion: CustomerSuggestion) => void;
}

const FIELD_HEIGHT = "h-12";

function FieldMessage({ field, children }: { field: string; children: string }) {
  return (
    <p className="text-meta text-danger-600" role="alert" data-test-selector={fieldErrorTestSelector(field)}>
      {children}
    </p>
  );
}

// Snapshotted onto the order (no Customer entity yet); only name, number and address are up front, the rest is folded away.
export function CustomerForm({ register, control, setValue, errors, onPickSuggestion }: CustomerFormProps) {
  const t = useTranslations("sell.whatsapp.customer");
  const translateError = useTranslateError();

  // A pasted WhatsApp location ("32.313, 35.028") fills both coordinates.
  function handleLatitudeChange(value: string) {
    const pair = splitCoordinatePair(value);
    if (!pair) return;
    setValue("latitude", pair.latitude, { shouldValidate: true });
    setValue("longitude", pair.longitude, { shouldValidate: true });
  }

  return (
    <div className="flex flex-col gap-5">
      <FormField label="sell.whatsapp.customer.name" htmlFor="customer-name">
        <Input
          id="customer-name"
          data-testid={fieldTestSelector("customer-name")}
          autoComplete="off"
          hasError={!!errors.name}
          placeholder={t("namePlaceholder")}
          className={FIELD_HEIGHT}
          {...register("name")}
        />
        {errors.name && <FieldMessage field="customer-name">{translateError(errors.name.message ?? "")}</FieldMessage>}
      </FormField>

      <FormField label="sell.whatsapp.customer.phone" htmlFor="customer-phone">
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
        {errors.phone && <FieldMessage field="customer-phone">{translateError(errors.phone.message ?? "")}</FieldMessage>}
      </FormField>

      <FormField label="sell.whatsapp.customer.address" htmlFor="customer-address">
        <Textarea
          id="customer-address"
          data-testid={fieldTestSelector("customer-address")}
          placeholder={t("addressPlaceholder")}
          {...register("address")}
        />
      </FormField>

      <details className="rounded-panel border border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 text-value font-medium text-ink marker:hidden [&::-webkit-details-marker]:hidden">
          {t("moreDetails")}
          <ChevronDown className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />
        </summary>

        <div className="flex flex-col gap-5 border-t border-line p-4">
          <FormField label="sell.whatsapp.customer.whatsapp" htmlFor="customer-whatsapp">
            <Controller
              control={control}
              name="whatsapp"
              render={({ field }) => (
                <ShopPhoneInput
                  id="customer-whatsapp"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={!!errors.whatsapp}
                />
              )}
            />
            {errors.whatsapp ? (
              <FieldMessage field="customer-whatsapp">{translateError(errors.whatsapp.message ?? "")}</FieldMessage>
            ) : (
              <p className="text-micro text-ink-muted">{t("whatsappHint")}</p>
            )}
          </FormField>

          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-label font-medium text-ink">
              <MapPin className="size-4" aria-hidden="true" />
              {t("location")}
            </p>
            <p className="text-micro text-ink-muted">{t("locationHint")}</p>
            {/* Plain decimal keypad (coordinates may be negative), LTR so the minus stays in front. */}
            <Input
              type="text"
              inputMode="decimal"
              pattern={SIGNED_DECIMAL_INPUT_PATTERN}
              dir="ltr"
              data-testid="field-latitude"
              placeholder={t("latitude")}
              aria-label={t("latitude")}
              hasError={!!errors.latitude}
              className={FIELD_HEIGHT}
              {...register("latitude", { onChange: (event) => handleLatitudeChange(event.target.value) })}
            />
            <Input
              type="text"
              inputMode="decimal"
              pattern={SIGNED_DECIMAL_INPUT_PATTERN}
              dir="ltr"
              data-testid="field-longitude"
              placeholder={t("longitude")}
              aria-label={t("longitude")}
              hasError={!!errors.longitude}
              className={FIELD_HEIGHT}
              {...register("longitude")}
            />
            {(errors.latitude || errors.longitude) && (
              <FieldMessage field="coordinates">
                {translateError(errors.latitude?.message ?? errors.longitude?.message ?? "")}
              </FieldMessage>
            )}
          </div>

          <FormField label="sell.whatsapp.customer.note" htmlFor="customer-note">
            <Textarea
              id="customer-note"
              data-testid={fieldTestSelector("customer-note")}
              placeholder={t("notePlaceholder")}
              {...register("note")}
            />
          </FormField>
        </div>
      </details>
    </div>
  );
}
