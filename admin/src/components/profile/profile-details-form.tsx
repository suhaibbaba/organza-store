"use client";

import type { ComponentProps } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Alert, FormField, Input, PhoneCountryProvider, PhoneInput, SaveBar, useToast } from "@store/ui";
import type { Profile } from "@organza/shared/types/profile";
import { PALESTINE_PHONE_PREFIXES } from "@organza/shared/constants/phone";
import { fieldTestSelector } from "@organza/shared/lib/testSelector";
import { ProfileSection } from "@/components/profile/profile-section";
import { useUpdateProfileMutation } from "@/hooks/use-profile";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useTranslateError } from "@/hooks/use-translate-error";
import { fieldErrorKey } from "@/lib/field-error-key";
import { ApiError } from "@/lib/api/errors";
import {
  profileFormSchema,
  profileToFormValues,
  toProfilePayload,
  type ProfileFormValues,
} from "@/lib/validation/profile-form";

type PhoneCountry = ComponentProps<typeof PhoneCountryProvider>["country"];

export function ProfileDetailsForm({ profile }: { profile: Profile }) {
  const t = useTranslations("profile.details");
  const toast = useToast();
  const translateError = useTranslateError();
  const save = useUpdateProfileMutation();
  const { data: settings } = useSettingsQuery();
  const phoneCountry: PhoneCountry = settings?.defaultCountryCode === PALESTINE_PHONE_PREFIXES[1] ? "IL" : "PS";

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: profileToFormValues(profile),
  });

  async function onSubmit(values: ProfileFormValues) {
    try {
      const saved = await save.mutateAsync(toProfilePayload(values));
      reset(profileToFormValues(saved));
      toast.success("profile.details.saved");
    } catch {
      // shown above the fields through save.isError
    }
  }

  return (
    <ProfileSection name="details">
      <PhoneCountryProvider country={phoneCountry}>
        <form id="profile-details" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          {save.isError && (
            <Alert tone="danger" data-testid="profile-details-error">
              {translateError(save.error instanceof ApiError ? save.error.code : "error.internal")}
            </Alert>
          )}

          <FormField label="profile.details.name" htmlFor="name" error={errors.name} errorKey={fieldErrorKey(errors.name)} required>
            <Input
              id="name"
              data-test-selector={fieldTestSelector("name")}
              placeholder={t("namePlaceholder")}
              hasError={!!errors.name}
              {...register("name")}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="profile.details.phone" htmlFor="phone" error={errors.phone} errorKey={fieldErrorKey(errors.phone)} required>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <PhoneInput
                    id="phone"
                    data-test-selector={fieldTestSelector("phone")}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "")}
                    onBlur={field.onBlur}
                    hasError={!!errors.phone}
                  />
                )}
              />
            </FormField>

            <FormField
              label="profile.details.whatsapp"
              htmlFor="whatsapp"
              error={errors.whatsapp}
              errorKey={fieldErrorKey(errors.whatsapp)}
              hint="profile.details.whatsappHint"
              optional
            >
              <Controller
                control={control}
                name="whatsapp"
                render={({ field }) => (
                  <PhoneInput
                    id="whatsapp"
                    data-test-selector={fieldTestSelector("whatsapp")}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "")}
                    onBlur={field.onBlur}
                    hasError={!!errors.whatsapp}
                  />
                )}
              />
            </FormField>
          </div>

          <FormField label="profile.details.email" htmlFor="email" note="profile.details.emailNote">
            <Input id="email" type="email" dir="ltr" data-test-selector={fieldTestSelector("email")} value={profile.email} disabled readOnly />
          </FormField>
        </form>
      </PhoneCountryProvider>

      <SaveBar
        data-testid="profile-save"
        visible={isDirty || save.isPending}
        saving={save.isPending}
        onSave={() => void handleSubmit(onSubmit)()}
        onDiscard={() => {
          save.reset();
          reset(profileToFormValues(profile));
        }}
      />
    </ProfileSection>
  );
}
