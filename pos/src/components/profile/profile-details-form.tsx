"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Alert, FormField, Input, SaveBar, useToast } from "@store/ui";
import { ERROR_CODES } from "@store/shared/constants/errors";
import type { Profile } from "@store/shared/types/profile";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { ProfileSection } from "@/components/profile/profile-section";
import { ShopPhoneInput } from "@/components/sell/customer-phone-field";
import { useUpdateProfileMutation } from "@/hooks/use-profile";
import { useTranslateError } from "@/hooks/use-translate-error";
import { fieldErrorKey } from "@/lib/field-error-key";
import { ApiError } from "@/lib/api/errors";
import {
  profileFormSchema,
  profileToFormValues,
  toProfilePayload,
  type ProfileFormValues,
} from "@/lib/validation/profile";

export function ProfileDetailsForm({ profile }: { profile: Profile }) {
  const t = useTranslations("profile.details");
  const toast = useToast();
  const translateError = useTranslateError();
  const save = useUpdateProfileMutation();

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
      <form id="pos-profile-details" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {save.isError && (
          <Alert tone="danger" data-testid="pos-profile-details-error">
            {translateError(save.error instanceof ApiError ? save.error.code : ERROR_CODES.INTERNAL)}
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

        <div className="grid grid-cols-1 gap-4 tab:grid-cols-2">
          <FormField label="profile.details.phone" htmlFor="phone" error={errors.phone} errorKey={fieldErrorKey(errors.phone)} required>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <ShopPhoneInput id="phone" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.phone} />
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
                <ShopPhoneInput
                  id="whatsapp"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={!!errors.whatsapp}
                />
              )}
            />
          </FormField>
        </div>

        <FormField label="profile.details.email" htmlFor="email" note="profile.details.emailNote">
          <Input id="email" type="email" dir="ltr" data-test-selector={fieldTestSelector("email")} value={profile.email} disabled readOnly />
        </FormField>
      </form>

      <SaveBar
        data-testid="pos-profile-save"
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
