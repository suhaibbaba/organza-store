"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useTranslateError } from "@/hooks/use-translate-error";
import { requestPasswordReset } from "@/lib/api/password-setup";
import { ApiError } from "@/lib/api/errors";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation/set-password";
import { fieldTestSelector } from "@organza/shared/lib/testSelector";
import { Alert, Button, buttonClassName, FormField, Input } from "@store/ui";
import { AuthFieldError } from "@/components/auth/auth-field-error";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword");
  const translateError = useTranslateError();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordValues) {
    setFormError(null);
    try {
      await requestPasswordReset(values.email);
      // Same answer whether or not the address exists, so the form never reveals who works here.
      setSent(true);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.code : "error.internal");
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="success">{t("sentBody")}</Alert>
        <Link href="/login" className={buttonClassName({ variant: "secondary", className: "w-full" })}>
          {t("back")}
        </Link>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {formError && <Alert tone="danger">{translateError(formError)}</Alert>}

      <FormField label="auth.forgotPassword.emailLabel" htmlFor="email">
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          placeholder={t("emailPlaceholder")}
          hasError={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          data-testid={fieldTestSelector("email")}
          {...register("email")}
        />
        {errors.email && <AuthFieldError field="email">{translateError(errors.email.message ?? "")}</AuthFieldError>}
      </FormField>

      <Button type="submit" data-test-selector="forgot-password-submit" isLoading={isSubmitting} className="mt-2 w-full">
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>

      <Link href="/login" className={buttonClassName({ variant: "quiet", className: "w-full" })}>
        {t("back")}
      </Link>
    </form>
  );
}
