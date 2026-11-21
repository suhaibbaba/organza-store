"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Alert, Button, FormField, Modal, PasswordInput, useToast } from "@store/ui";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { useChangePasswordMutation } from "@/hooks/use-profile";
import { useTranslateError } from "@/hooks/use-translate-error";
import { fieldErrorKey } from "@/lib/field-error-key";
import { ApiError } from "@/lib/api/errors";
import {
  EMPTY_PASSWORD_CHANGE,
  passwordChangeSchema,
  type PasswordChangeValues,
} from "@/lib/validation/profile-form";
import type { PasswordChangeModalProps } from "@/types/profile";

const FORM_ID = "password-change-form";

export function PasswordChangeModal({ open, onOpenChange }: PasswordChangeModalProps) {
  const t = useTranslations("profile.password");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const translateError = useTranslateError();
  const change = useChangePasswordMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordChangeValues>({ resolver: zodResolver(passwordChangeSchema), defaultValues: EMPTY_PASSWORD_CHANGE });

  useEffect(() => {
    if (open) {
      reset(EMPTY_PASSWORD_CHANGE);
      change.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start clean only when the modal opens
  }, [open]);

  async function onSubmit(values: PasswordChangeValues) {
    try {
      await change.mutateAsync({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      toast.success("profile.password.changed");
      onOpenChange(false);
    } catch {
      // shown in the modal through change.isError
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      data-testid="password-change-modal"
      title="profile.password.title"
      description="profile.password.description"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={change.isPending}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} data-test-selector="password-change-save" isLoading={change.isPending}>
            {t("submit")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {change.isError && (
          <Alert tone="danger" data-testid="password-change-error">
            {translateError(change.error instanceof ApiError ? change.error.code : "error.internal")}
          </Alert>
        )}

        <FormField
          label="profile.password.current"
          htmlFor="currentPassword"
          error={errors.currentPassword}
          errorKey={fieldErrorKey(errors.currentPassword)}
          required
        >
          <PasswordInput
            id="currentPassword"
            autoComplete="current-password"
            data-test-selector={fieldTestSelector("currentPassword")}
            placeholder={t("currentPlaceholder")}
            hasError={!!errors.currentPassword}
            {...register("currentPassword")}
          />
        </FormField>

        <FormField
          label="profile.password.new"
          htmlFor="newPassword"
          error={errors.newPassword}
          errorKey={fieldErrorKey(errors.newPassword)}
          note="profile.password.newNote"
          required
        >
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            data-test-selector={fieldTestSelector("newPassword")}
            placeholder={t("newPlaceholder")}
            hasError={!!errors.newPassword}
            {...register("newPassword")}
          />
        </FormField>

        <FormField label="profile.password.confirm" htmlFor="confirm" error={errors.confirm} errorKey={fieldErrorKey(errors.confirm)} required>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            data-test-selector={fieldTestSelector("confirm")}
            placeholder={t("confirmPlaceholder")}
            hasError={!!errors.confirm}
            {...register("confirm")}
          />
        </FormField>
      </form>
    </Modal>
  );
}
