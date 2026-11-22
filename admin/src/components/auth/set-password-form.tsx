"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PASSWORD_MIN_LENGTH } from "@store/shared/constants/validation";
import { PASSWORD_SETUP_TOKEN_PARAM } from "@store/shared/constants/passwordSetup";
import { Link } from "@/i18n/navigation";
import { PASSWORD_TOKEN_QUERY_KEY } from "@/constants/api";
import { useTranslateError } from "@/hooks/use-translate-error";
import { completePasswordSetup, verifyPasswordToken } from "@/lib/api/password-setup";
import { ApiError } from "@/lib/api/errors";
import { setPasswordSchema, type SetPasswordValues } from "@/lib/validation/set-password";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { Alert, Button, buttonClassName, FormField, PasswordInput, Spinner, Typography } from "@store/ui";
import { fieldErrorKey } from "@/lib/field-error-key";
import type { PasswordTokenCheck } from "@/types/auth";

// Where an emailed link lands: checking, a dead link, or the form.
export function SetPasswordForm() {
  const t = useTranslations("auth.setPassword");
  const translateError = useTranslateError();
  const searchParams = useSearchParams();
  const token = searchParams.get(PASSWORD_SETUP_TOKEN_PARAM) ?? "";

  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Checked before typing; never retried, since a rejected link is settled and the endpoint is rate-limited.
  const check = useQuery<PasswordTokenCheck>({
    queryKey: [PASSWORD_TOKEN_QUERY_KEY, token],
    queryFn: () => verifyPasswordToken(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordValues>({ resolver: zodResolver(setPasswordSchema) });

  async function onSubmit(values: SetPasswordValues) {
    setFormError(null);
    try {
      await completePasswordSetup(token, values.password);
      setDone(true);
    } catch (error) {
      // The link can expire between the check and the submit.
      setFormError(error instanceof ApiError ? error.code : "error.internal");
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">{t("successBody")}</Alert>
        <Link href="/login" className={buttonClassName({ className: "w-full" })}>
          {t("goToLogin")}
        </Link>
      </div>
    );
  }

  // No token at all means a half-pasted link, said plainly rather than "expired".
  if (!token || check.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="danger">{t(!token ? "missingToken" : "invalidBody")}</Alert>
        <Link href="/forgot-password" className={buttonClassName({ variant: "secondary", className: "w-full" })}>
          {t("requestNewLink")}
        </Link>
      </div>
    );
  }

  if (!check.data) {
    return (
      <Typography as="p" variant="small" tone="muted" className="flex items-center gap-2 py-4">
        <Spinner />
        {t("checking")}
      </Typography>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {/* method="post" is a fallback: a native submit before hydration keeps the password out of the URL. */}
      <Typography as="p" variant="small" tone="muted">
        {t("forAccount", { email: check.data.email })}
      </Typography>

      {formError && <Alert tone="danger">{translateError(formError)}</Alert>}

      <FormField label="auth.setPassword.passwordLabel" required htmlFor="password" error={errors.password} errorKey={fieldErrorKey(errors.password)} errorValues={{ min: PASSWORD_MIN_LENGTH }}>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder={t("passwordPlaceholder")}
          hasError={!!errors.password}
          data-testid={fieldTestSelector("password")}
          {...register("password")}
        />
      </FormField>

      <FormField label="auth.setPassword.confirmLabel" required htmlFor="confirm" error={errors.confirm} errorKey={fieldErrorKey(errors.confirm)}>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          placeholder={t("confirmPlaceholder")}
          hasError={!!errors.confirm}
          data-testid={fieldTestSelector("confirm")}
          {...register("confirm")}
        />
      </FormField>

      <Button type="submit" data-test-selector="set-password-submit" isLoading={isSubmitting} className="w-full">
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
