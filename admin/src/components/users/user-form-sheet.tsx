"use client";

import { useEffect, type ComponentProps } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  Alert,
  Button,
  Drawer,
  FormField,
  Input,
  PasswordInput,
  PhoneCountryProvider,
  PhoneInput,
  Select,
} from "@store/ui";
import { can } from "@organza/shared/lib/permissions";
import { ROLES } from "@organza/shared/constants/roles";
import { PALESTINE_PHONE_PREFIXES } from "@organza/shared/constants/phone";
import { fieldErrorTestSelector, fieldTestSelector } from "@organza/shared/lib/testSelector";
import type { User } from "@organza/shared/types/user";
import { useSession } from "@/components/providers/session-provider";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useCreateUserMutation, useUpdateUserMutation } from "@/hooks/use-users";
import { useSettingsQuery } from "@/hooks/use-settings";
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

const FORM_ID = "user-form";

type PhoneCountry = ComponentProps<typeof PhoneCountryProvider>["country"];

interface UserFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  user?: User;
}

function FieldMessage({ field, message }: { field: string; message: string }) {
  return (
    <p className="text-meta text-danger-600" role="alert" data-test-selector={fieldErrorTestSelector(field)}>
      {message}
    </p>
  );
}

export function UserFormSheet({ open, onOpenChange, mode, user }: UserFormSheetProps) {
  const t = useTranslations("users.form");
  const tRole = useTranslations("users.role");
  const translateError = useTranslateError();
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

  // The drawer stays mounted while closed, so the form re-syncs with its target user on every open.
  useEffect(() => {
    if (open) reset(mode === "edit" && user ? userToFormValues(user) : DEFAULT_USER_FORM_VALUES);
  }, [open, mode, user, reset]);

  const createMutation = useCreateUserMutation();
  const updateMutation = useUpdateUserMutation(user?.id ?? "");
  const mutation = mode === "create" ? createMutation : updateMutation;

  // A blank password is the normal case: on create they are emailed a link, on edit it keeps the current one.
  async function onSubmit(values: UserFormValues) {
    try {
      if (mode === "create") {
        await createMutation.mutateAsync(toCreatePayload(values));
      } else if (user) {
        await updateMutation.mutateAsync(toUpdatePayload(values, canViewSensitive));
      }
      onOpenChange(false);
    } catch {
      // surfaced below via mutation.isError
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      data-testid="sheet-user-form"
      title={t(mode === "create" ? "createTitle" : "editTitle")}
      descriptionKey="users.subtitle"
      footer={
        <Button type="submit" form={FORM_ID} data-test-selector="user-save" isLoading={mutation.isPending}>
          {mutation.isPending
            ? t(mode === "create" ? "creating" : "saving")
            : t(mode === "create" ? "create" : "save")}
        </Button>
      }
    >
      <PhoneCountryProvider country={phoneCountry}>
        <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormField label="users.form.name" htmlFor="name">
            <Input
              id="name"
              data-test-selector={fieldTestSelector("name")}
              hasError={!!errors.name}
              {...register("name")}
            />
            {errors.name && <FieldMessage field="name" message={translateError(errors.name.message ?? "")} />}
          </FormField>

          <FormField
            label="users.form.email"
            htmlFor="email"
            note={mode === "edit" ? "users.form.emailHint" : undefined}
          >
            {mode === "create" ? (
              <Input
                id="email"
                type="email"
                dir="ltr"
                data-test-selector={fieldTestSelector("email")}
                hasError={!!errors.email}
                {...register("email")}
              />
            ) : (
              // Email can't change after creation, so it stays outside RHF and never reaches the submit.
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
            {mode === "create" && errors.email && (
              <FieldMessage field="email" message={translateError(errors.email.message ?? "")} />
            )}
          </FormField>

          <FormField
            label="users.form.password"
            htmlFor="password"
            note={
              errors.password
                ? undefined
                : mode === "create"
                  ? "users.form.passwordHintCreate"
                  : "users.form.passwordHintEdit"
            }
          >
            <PasswordInput
              id="password"
              autoComplete="new-password"
              data-test-selector={fieldTestSelector("password")}
              placeholder={mode === "create" ? t("passwordPlaceholderCreate") : t("passwordPlaceholderEdit")}
              hasError={!!errors.password}
              {...register("password")}
            />
            {errors.password && (
              <FieldMessage field="password" message={translateError(errors.password.message ?? "")} />
            )}
          </FormField>

          {mode === "edit" && user && <PasswordResetAction user={user} />}

          <FormField label="users.form.role" htmlFor="role">
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

          <FormField label="users.form.phone" htmlFor="phone">
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
            {errors.phone && <FieldMessage field="phone" message={translateError(errors.phone.message ?? "")} />}
          </FormField>

          <FormField
            label="users.form.whatsapp"
            htmlFor="whatsapp"
            note={errors.whatsapp ? undefined : "users.form.whatsappHint"}
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
            {errors.whatsapp && (
              <FieldMessage field="whatsapp" message={translateError(errors.whatsapp.message ?? "")} />
            )}
          </FormField>

          {canViewSensitive && (
            <FormField label="users.form.idNumber" htmlFor="idNumber">
              <Input
                id="idNumber"
                data-test-selector={fieldTestSelector("idNumber")}
                hasError={!!errors.idNumber}
                {...register("idNumber")}
              />
            </FormField>
          )}

          {mutation.isError && (
            <Alert tone="danger" data-testid="alert-destructive">
              {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
            </Alert>
          )}
        </form>
      </PhoneCountryProvider>
    </Drawer>
  );
}
