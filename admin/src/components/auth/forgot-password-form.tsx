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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

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
      // Shown whether or not that address belongs to an account — the API
      // deliberately answers the same either way, and so does this screen.
      // Anything else would turn the form into a way of asking "does this
      // person work here?".
      setSent(true);
    } catch (error) {
      // Only a genuine failure gets here: too many attempts, or the API being
      // unreachable.
      setFormError(error instanceof ApiError ? error.code : "error.internal");
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="success">{t("sentBody")}</Alert>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">{t("back")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {formError && <Alert variant="destructive">{translateError(formError)}</Alert>}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("emailLabel")}</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          placeholder={t("emailPlaceholder")}
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && <p className="text-sm text-destructive">{translateError(errors.email.message ?? "")}</p>}
      </div>

      <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
        {isSubmitting ? (
          <>
            <Spinner />
            {t("submitting")}
          </>
        ) : (
          t("submit")
        )}
      </Button>

      <Button asChild variant="ghost" className="w-full">
        <Link href="/login">{t("back")}</Link>
      </Button>
    </form>
  );
}
