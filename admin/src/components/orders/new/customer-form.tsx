"use client";

import { Controller, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue } from "react-hook-form";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { SIGNED_DECIMAL_INPUT_PATTERN } from "@/constants/numeric";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useTranslateError } from "@/hooks/use-translate-error";
import { splitCoordinatePair, type OrderCustomerFormValues } from "@/lib/validation/order-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneField } from "@/components/ui/phone-field";

interface CustomerFormProps {
  register: UseFormRegister<OrderCustomerFormValues>;
  control: Control<OrderCustomerFormValues>;
  setValue: UseFormSetValue<OrderCustomerFormValues>;
  errors: FieldErrors<OrderCustomerFormValues>;
}

// Who the order goes to. Snapshotted onto the order itself — there is no
// Customer entity yet (spec.md "Customer information") — so this is typed out
// per order rather than picked from a list.
export function CustomerForm({ register, control, setValue, errors }: CustomerFormProps) {
  const t = useTranslations("orders.new.customer");
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="customer-name">{t("name")}</Label>
          <Input id="customer-name" aria-invalid={!!errors.name} {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{translateError(errors.name.message ?? "")}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="customer-phone">{t("phone")}</Label>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <PhoneField
                id="customer-phone"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                defaultCountryCode={settings?.defaultCountryCode}
                ariaInvalid={!!errors.phone}
                prefixAriaLabel={t("phonePrefixLabel")}
              />
            )}
          />
          {errors.phone && <p className="text-sm text-destructive">{translateError(errors.phone.message ?? "")}</p>}
        </div>

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
          <Label htmlFor="customer-address">{t("address")}</Label>
          <Textarea id="customer-address" placeholder={t("addressPlaceholder")} {...register("address")} />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden="true" />
            {t("location")}
          </Label>
          <p className="text-xs text-muted-foreground">{t("locationHint")}</p>
          <div className="flex flex-col gap-2">
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
          </div>
          {(errors.latitude || errors.longitude) && (
            <p className="text-sm text-destructive">
              {translateError((errors.latitude?.message ?? errors.longitude?.message) ?? "")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="customer-note">{t("note")}</Label>
          <Textarea id="customer-note" placeholder={t("notePlaceholder")} {...register("note")} />
        </div>
      </CardContent>
    </Card>
  );
}
