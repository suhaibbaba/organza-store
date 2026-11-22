"use client";

import {
  Controller,
  type Control,
  type FieldError,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormField, Input, Section, Textarea } from "@store/ui";
import type { CustomerSuggestion } from "@store/shared/types/order";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { SIGNED_DECIMAL_INPUT_PATTERN } from "@/constants/numeric";
import { errorMessageKey } from "@/hooks/use-translate-error";
import { splitCoordinatePair, type OrderCustomerFormValues } from "@/lib/validation/customer";
import { CustomerPhoneField, ShopPhoneInput } from "@/components/sell/customer-phone-field";

interface CustomerFormProps {
  register: UseFormRegister<OrderCustomerFormValues>;
  control: Control<OrderCustomerFormValues>;
  setValue: UseFormSetValue<OrderCustomerFormValues>;
  errors: FieldErrors<OrderCustomerFormValues>;
  onPickSuggestion: (suggestion: CustomerSuggestion) => void;
}

// Schema messages are backend error codes; FormField wants the message key they map to.
function codeKey(error: FieldError | undefined): string | undefined {
  return error?.message ? errorMessageKey(error.message) : undefined;
}

// Snapshotted onto the order (no Customer entity yet); only name, number and address are up front, the rest is folded away.
export function CustomerForm({ register, control, setValue, errors, onPickSuggestion }: CustomerFormProps) {
  const t = useTranslations("sell.whatsapp.customer");

  // A pasted WhatsApp location ("32.313, 35.028") fills both coordinates.
  function handleLatitudeChange(value: string) {
    const pair = splitCoordinatePair(value);
    if (!pair) {
      return;
    }
    setValue("latitude", pair.latitude, { shouldValidate: true });
    setValue("longitude", pair.longitude, { shouldValidate: true });
  }

  return (
    <div className="flex flex-col gap-5">
      <FormField
        label="sell.whatsapp.customer.name"
        htmlFor="customer-name"
        required
        error={errors.name}
        errorKey={codeKey(errors.name)}
      >
        <Input
          id="customer-name"
          data-testid={fieldTestSelector("customer-name")}
          autoComplete="off"
          hasError={!!errors.name}
          placeholder={t("namePlaceholder")}
          {...register("name")}
        />
      </FormField>

      <FormField
        label="sell.whatsapp.customer.phone"
        htmlFor="customer-phone"
        required
        error={errors.phone}
        errorKey={codeKey(errors.phone)}
      >
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
      </FormField>

      <FormField label="sell.whatsapp.customer.address" htmlFor="customer-address" optional>
        <Textarea
          id="customer-address"
          data-testid={fieldTestSelector("customer-address")}
          placeholder={t("addressPlaceholder")}
          {...register("address")}
        />
      </FormField>

      <Section
        title={t("moreDetails")}
        collapsible
        defaultOpen={false}
        forceOpen={Boolean(errors.whatsapp || errors.latitude || errors.longitude)}
        className="shadow-none"
        bodyClassName="flex flex-col gap-5"
      >
        <FormField
          label="sell.whatsapp.customer.whatsapp"
          htmlFor="customer-whatsapp"
          optional
          note="sell.whatsapp.customer.whatsappHint"
          error={errors.whatsapp}
          errorKey={codeKey(errors.whatsapp)}
        >
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
        </FormField>

        <FormField
          label="sell.whatsapp.customer.location"
          htmlFor="customer-latitude"
          optional
          note="sell.whatsapp.customer.locationHint"
          error={errors.latitude ?? errors.longitude}
          errorKey={codeKey(errors.latitude ?? errors.longitude)}
          data-testid={fieldTestSelector("coordinates")}
        >
          {/* Plain decimal keypad (coordinates may be negative), LTR so the minus stays in front. */}
          <Input
            id="customer-latitude"
            type="text"
            inputMode="decimal"
            pattern={SIGNED_DECIMAL_INPUT_PATTERN}
            dir="ltr"
            data-testid="field-latitude"
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
            data-testid="field-longitude"
            placeholder={t("longitude")}
            aria-label={t("longitude")}
            hasError={!!errors.longitude}
            {...register("longitude")}
          />
        </FormField>

        <FormField label="sell.whatsapp.customer.note" htmlFor="customer-note" optional>
          <Textarea
            id="customer-note"
            data-testid={fieldTestSelector("customer-note")}
            placeholder={t("notePlaceholder")}
            {...register("note")}
          />
        </FormField>
      </Section>
    </div>
  );
}
