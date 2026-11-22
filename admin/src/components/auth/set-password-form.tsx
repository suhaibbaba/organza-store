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
import { setPasswordSchema, SET_PASSWORD_MISMATCH, type SetPasswordValues } from "@/lib/validation/set-password";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { Alert, Button, buttonClassName, FormField, PasswordInput, Spinner } from "@store/ui";
import { AuthFieldError } from "@/components/auth/auth-field-error";
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
      <div className="flex flex-col gap-5">
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
      <div className="flex flex-col gap-5">
        <Alert tone="danger">{t(!token ? "missingToken" : "invalidBody")}</Alert>
        <Link href="/forgot-password" className={buttonClassName({ variant: "secondary", className: "w-full" })}>
          {t("requestNewLink")}
        </Link>
      </div>
    );
  }

  if (!check.data) {
    return (
      <p className="flex items-center gap-2 py-4 text-label text-ink-muted">
        <Spinner />
        {t("checking")}
      </p>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {/* method="post" is a fallback: a native submit before hydration keeps the password out of the URL. */}
      <p className="text-label text-ink-muted" dir="ltr">
        {t("forAccount", { email: check.data.email })}
      </p>

      {formError && <Alert tone="danger">{translateError(formError)}</Alert>}

      <FormField label="auth.setPassword.passwordLabel" required htmlFor="password">
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder={t("passwordPlaceholder")}
          hasError={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          data-testid={fieldTestSelector("password")}
          {...register("password")}
        />
        {errors.password && (
          <AuthFieldError field="password">
            {translateError(errors.password.message ?? "", { min: PASSWORD_MIN_LENGTH })}
          </AuthFieldError>
        )}
      </FormField>

      <FormField label="auth.setPassword.confirmLabel" required htmlFor="confirm">
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          placeholder={t("confirmPlaceholder")}
          hasError={!!errors.confirm}
          aria-describedby={errors.confirm ? "confirm-error" : undefined}
          data-testid={fieldTestSelector("confirm")}
          {...register("confirm")}
        />
        {errors.confirm && (
          <AuthFieldError field="confirm">
            {errors.confirm.message === SET_PASSWORD_MISMATCH
              ? t("mismatch")
              : translateError(errors.confirm.message ?? "", { min: PASSWORD_MIN_LENGTH })}
          </AuthFieldError>
        )}
      </FormField>

      <Button type="submit" data-test-selector="set-password-submit" isLoading={isSubmitting} className="mt-2 w-full">
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
