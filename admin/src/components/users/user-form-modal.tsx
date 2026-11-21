"use client";

import { useEffect, type ComponentProps, type ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  PasswordInput,
  PhoneCountryProvider,
  PhoneInput,
  Select,
  Typography,
  useToast,
} from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { ROLES } from "@store/shared/constants/roles";
import { PALESTINE_PHONE_PREFIXES } from "@store/shared/constants/phone";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { useSession } from "@/components/providers/session-provider";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useCreateUserMutation, useUpdateUserMutation } from "@/hooks/use-users";
import { useSettingsQuery } from "@/hooks/use-settings";
import { fieldErrorKey } from "@/lib/field-error-key";
import {
  userFormSchema,
  DEFAULT_USER_FORM_VALUES,
  userToFormValues,
  toCreatePayload,
  toUpdatePayload,
  type UserFormValues,
} from "@/lib/validation/user-form";
import { PasswordResetAction } from "@/components/users/password-reset-action";
import { ApiError } from "@/lib/api/errors";
import type { UserFormModalProps } from "@/types/user";

const FORM_ID = "user-form";

type PhoneCountry = ComponentProps<typeof PhoneCountryProvider>["country"];

function FormGroup({ name, title, children }: { name: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`user-form-${name}`} data-test-selector={`user-form-${name}`} className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0">
      <Typography variant="h4" as="h3" id={`user-form-${name}`}>
        {title}
      </Typography>
      {children}
    </section>
  );
}

export function UserFormModal({ open, onOpenChange, mode, user }: UserFormModalProps) {
  const t = useTranslations("users.form");
  const tRole = useTranslations("users.role");
  const tCommon = useTranslations("common");
  const translateError = useTranslateError();
  const toast = useToast();
  const { user: currentUser } = useSession();
  const canViewSensitive = can(currentUser, "user.viewSensitive");
  const { data: settings } = useSettingsQuery();
  const phoneCountry: PhoneCountry = settings?.defaultCountryCode === PALESTINE_PHONE_PREFIXES[1] ? "IL" : "PS";

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: DEFAULT_USER_FORM_VALUES,
  });

  // The modal stays mounted while closed, so the form re-syncs with its target on every open.
  useEffect(() => {
    if (open) reset(mode === "edit" && user ? userToFormValues(user) : DEFAULT_USER_FORM_VALUES);
  }, [open, mode, user, reset]);

  const createMutation = useCreateUserMutation();
  const updateMutation = useUpdateUserMutation(user?.id ?? "");
  const mutation = mode === "create" ? createMutation : updateMutation;

  useEffect(() => {
    if (open) {
      createMutation.reset();
      updateMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear the last attempt's error only when the modal opens
  }, [open]);

  // A blank password is the normal case: on create they are emailed a link, on edit it keeps the current one.
  async function onSubmit(values: UserFormValues) {
    try {
      if (mode === "create") {
        await createMutation.mutateAsync(toCreatePayload(values));
        toast.success("users.form.created");
      } else if (user) {
        await updateMutation.mutateAsync(toUpdatePayload(values, canViewSensitive));
        toast.success("users.form.saved");
      }
      onOpenChange(false);
    } catch {
      // shown in the modal through mutation.isError
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      data-testid="user-form-modal"
      size="lg"
      title={mode === "create" ? "users.form.createTitle" : "users.form.editTitle"}
      description={mode === "create" ? "users.form.createDescription" : "users.form.editDescription"}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} data-test-selector="user-save" isLoading={mutation.isPending}>
            {t(mode === "create" ? "create" : "save")}
          </Button>
        </>
      }
    >
      <PhoneCountryProvider country={phoneCountry}>
        <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col divide-y divide-line">
          {mutation.isError && (
            <div className="pb-5">
              <Alert tone="danger" data-testid="user-form-error">
                {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
              </Alert>
            </div>
          )}

          <FormGroup name="account" title={t("groups.account")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="users.form.name" htmlFor="name" error={errors.name} errorKey={fieldErrorKey(errors.name)} required>
                <Input
                  id="name"
                  data-test-selector={fieldTestSelector("name")}
                  placeholder={t("namePlaceholder")}
                  hasError={!!errors.name}
                  {...register("name")}
                />
              </FormField>

              <FormField label="users.form.role" htmlFor="role" hint="users.form.roleHint">
                <Controller
                  control={control}
                  name="role"
                  render={({ field }) => (
                    <Select
                      id="role"
                      data-testid={fieldTestSelector("role")}
                      options={ROLES.map((r) => ({ value: r, label: tRole(r) }))}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  )}
                />
              </FormField>
            </div>

            <FormField
              label="users.form.email"
              htmlFor="email"
              error={mode === "create" ? errors.email : undefined}
              errorKey={fieldErrorKey(mode === "create" ? errors.email : undefined)}
              note={mode === "edit" ? "users.form.emailHint" : "users.form.emailHintCreate"}
              required={mode === "create"}
            >
              {mode === "create" ? (
                <Input
                  id="email"
                  type="email"
                  dir="ltr"
                  data-test-selector={fieldTestSelector("email")}
                  placeholder={t("emailPlaceholder")}
                  hasError={!!errors.email}
                  {...register("email")}
                />
              ) : (
                // Email can't change after creation, so it stays outside the form and never reaches the submit.
                <Input
                  id="email"
                  type="email"
                  dir="ltr"
                  data-test-selector={fieldTestSelector("email")}
                  value={user?.email ?? ""}
                  disabled
                  readOnly
                />
              )}
            </FormField>
          </FormGroup>

          <FormGroup name="contact" title={t("groups.contact")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="users.form.phone" htmlFor="phone" error={errors.phone} errorKey={fieldErrorKey(errors.phone)} required>
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
                label="users.form.whatsapp"
                htmlFor="whatsapp"
                error={errors.whatsapp}
                errorKey={fieldErrorKey(errors.whatsapp)}
                hint="users.form.whatsappHint"
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

            {canViewSensitive && (
              <FormField label="users.form.idNumber" htmlFor="idNumber" hint="users.form.idNumberHint" optional>
                <Input
                  id="idNumber"
                  dir="ltr"
                  data-test-selector={fieldTestSelector("idNumber")}
                  placeholder={t("idNumberPlaceholder")}
                  hasError={!!errors.idNumber}
                  className="sm:max-w-xs"
                  {...register("idNumber")}
                />
              </FormField>
            )}
          </FormGroup>

          <FormGroup name="sign-in" title={t("groups.signIn")}>
            {mode === "edit" && user && <PasswordResetAction user={user} />}

            <FormField
              label={mode === "create" ? "users.form.password" : "users.form.passwordEdit"}
              htmlFor="password"
              error={errors.password}
              errorKey={fieldErrorKey(errors.password)}
              note={mode === "create" ? "users.form.passwordHintCreate" : "users.form.passwordHintEdit"}
              optional
            >
              <PasswordInput
                id="password"
                autoComplete="new-password"
                data-test-selector={fieldTestSelector("password")}
                placeholder={mode === "create" ? t("passwordPlaceholderCreate") : t("passwordPlaceholderEdit")}
                hasError={!!errors.password}
                className="sm:max-w-xs"
                {...register("password")}
              />
            </FormField>
          </FormGroup>
        </form>
      </PhoneCountryProvider>
    </Modal>
  );
}
