"use client";

import { Controller, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { CheckCircle2, ExternalLink, MapPin } from "lucide-react";
import { Checkbox, FormField, Input, PhoneCountryProvider, PhoneInput, Spinner, Textarea, Typography } from "@store/ui";
import { splitPhone } from "@store/ui/lib/support/phone";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { coordinatesFromMapLink, googleMapsUrl, isShortMapLink } from "@organza/shared/lib/mapLink";
import { fieldErrorTestSelector, fieldTestSelector } from "@organza/shared/lib/testSelector";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useResolveMapLinkMutation } from "@/hooks/use-orders";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import type { CustomerFormProps } from "@/types/order";

function FieldMessage({ field, children }: { field: string; children: string }) {
  return (
    <Typography variant="caption" tone="error" as="p" role="alert" data-test-selector={fieldErrorTestSelector(field)}>
      {children}
    </Typography>
  );
}

// Only an online order is delivered back to somebody; snapshotted onto the order (spec.md "Customer information").
export function CustomerForm({ register, control, setValue, errors }: CustomerFormProps) {
  const t = useTranslations("orders.new.customer");
  const translateError = useTranslateError();
  const { data: settings } = useSettingsQuery();
  const defaultCountry = splitPhone(settings?.defaultCountryCode).country;
  const resolve = useResolveMapLinkMutation();

  const hasWhatsapp = useWatch({ control, name: "hasWhatsapp" });
  const latitude = useWatch({ control, name: "latitude" });
  const longitude = useWatch({ control, name: "longitude" });
  const hasPoint = latitude !== "" && longitude !== "";

  function setPoint(point: { latitude: number; longitude: number } | null) {
    setValue("latitude", point ? String(point.latitude) : "");
    setValue("longitude", point ? String(point.longitude) : "", { shouldValidate: !!point });
  }

  // A full Maps link carries its point; a short maps.app.goo.gl link has to be opened by the backend first.
  function handleLocationChange(value: string) {
    resolve.reset();
    const point = coordinatesFromMapLink(value);
    setPoint(point);
    if (point || !isShortMapLink(value)) return;
    // reset() above drops a stale link's callback, so only the latest paste can set the point.
    resolve.mutate(value.trim(), { onSuccess: setPoint });
  }

  const locationError = resolve.isError
    ? resolve.error instanceof ApiError
      ? resolve.error.code
      : ERROR_CODES.ORDER_LOCATION_LINK_INVALID
    : errors.location?.message;

  return (
    <div className="flex flex-col gap-4">
      <PhoneCountryProvider country={defaultCountry}>
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          <FormField label="orders.new.customer.name" htmlFor="customer-name">
            <Input
              id="customer-name"
              data-test-selector={fieldTestSelector("customer-name")}
              placeholder={t("namePlaceholder")}
              hasError={!!errors.name}
              {...register("name")}
            />
            {errors.name && (
              <FieldMessage field="customer-name">{translateError(errors.name.message ?? "")}</FieldMessage>
            )}
          </FormField>

          <FormField label="orders.new.customer.phone" htmlFor="customer-phone">
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <PhoneInput
                  id="customer-phone"
                  data-test-selector={fieldTestSelector("customer-phone")}
                  placeholder={t("phonePlaceholder")}
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
        </div>

        <div className="flex flex-col gap-3">
          <Controller
            control={control}
            name="hasWhatsapp"
            render={({ field }) => (
              <Checkbox
                id="customer-has-whatsapp"
                data-testid={fieldTestSelector("customer-has-whatsapp")}
                label={t("whatsappToggle")}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />

          {hasWhatsapp && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="orders.new.customer.whatsapp" htmlFor="customer-whatsapp">
                <Controller
                  control={control}
                  name="whatsapp"
                  render={({ field }) => (
                    <PhoneInput
                      id="customer-whatsapp"
                      data-test-selector={fieldTestSelector("customer-whatsapp")}
                      placeholder={t("phonePlaceholder")}
                      value={field.value}
                      onChange={(value) => field.onChange(value ?? "")}
                      onBlur={field.onBlur}
                      hasError={!!errors.whatsapp}
                    />
                  )}
                />
                {errors.whatsapp && (
                  <FieldMessage field="customer-whatsapp">{translateError(errors.whatsapp.message ?? "")}</FieldMessage>
                )}
              </FormField>
            </div>
          )}
        </div>
      </PhoneCountryProvider>

      <FormField label="orders.new.customer.address" htmlFor="customer-address">
        <Textarea
          id="customer-address"
          data-test-selector={fieldTestSelector("customer-address")}
          rows={2}
          placeholder={t("addressPlaceholder")}
          {...register("address")}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="orders.new.customer.location" htmlFor="customer-location">
          <Input
            id="customer-location"
            type="url"
            inputMode="url"
            dir="ltr"
            autoComplete="off"
            data-test-selector={fieldTestSelector("customer-location")}
            placeholder={t("locationPlaceholder")}
            hasError={!!locationError}
            {...register("location", { onChange: (event) => handleLocationChange(event.target.value) })}
          />
          {resolve.isPending ? (
            <Typography variant="caption" tone="muted" as="p" className="flex items-center gap-2">
              <Spinner />
              {t("locationResolving")}
            </Typography>
          ) : locationError ? (
            <FieldMessage field="customer-location">{translateError(locationError)}</FieldMessage>
          ) : hasPoint ? (
            <Typography variant="caption" as="p" className="flex flex-wrap items-center gap-x-3 gap-y-1" data-test-selector="customer-location-found">
              <span className="flex items-center gap-1 text-success-700">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                <span dir="ltr" className="tabular-nums">
                  {latitude}, {longitude}
                </span>
              </span>
              <a
                href={googleMapsUrl({ latitude: Number(latitude), longitude: Number(longitude) })}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary-600 transition-colors hover:text-primary-700 focus-link"
              >
                <MapPin className="size-4" aria-hidden="true" />
                {t("openInMaps")}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </Typography>
          ) : (
            <Typography variant="caption" tone="muted" as="p">{t("locationHint")}</Typography>
          )}
        </FormField>
      </div>
    </div>
  );
}
