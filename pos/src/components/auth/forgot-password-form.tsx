"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Alert, Button, FormField, Input, buttonClassName } from "@store/ui";
import { fieldTestSelector, testSelectorFor } from "@store/shared/lib/testSelector";
import { Link } from "@/i18n/navigation";
import { fieldErrorKey } from "@/lib/field-error-key";
import { useTranslateError } from "@/hooks/use-translate-error";
import { requestPasswordReset } from "@/lib/api/password-setup";
import { ApiError } from "@/lib/api/errors";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation/login";

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
      // Shown whether or not the address has an account, so the form can't answer "does this person work here?".
      setSent(true);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.code : "error.internal");
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success" icon={false} data-testid={testSelectorFor("alert", "success")}>
          {t("sentBody")}
        </Alert>
        <Link href="/login" className={buttonClassName({ variant: "secondary", className: "w-full" })}>
          {t("back")}
        </Link>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {formError && (
        <Alert tone="danger" icon={false} data-testid={testSelectorFor("alert", "destructive")}>
          {translateError(formError)}
        </Alert>
      )}

      <FormField
        label="auth.forgotPassword.emailLabel"
        required
        htmlFor="email"
        error={errors.email}
        errorKey={fieldErrorKey(errors.email)}
      >
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          placeholder={t("emailPlaceholder")}
          hasError={!!errors.email}
          data-testid={fieldTestSelector("email")}
          {...register("email")}
        />
      </FormField>

      <Button type="submit" data-test-selector="pos-forgot-password-submit" isLoading={isSubmitting} className="w-full">
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>

      <Link href="/login" className={buttonClassName({ variant: "quiet", className: "w-full" })}>
        {t("back")}
      </Link>
    </form>
  );
}
