"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PASSWORD_MIN_LENGTH } from "@shared/constants/validation";
import { PASSWORD_SETUP_TOKEN_PARAM } from "@shared/constants/passwordSetup";
import { Link } from "@/i18n/navigation";
import { PASSWORD_TOKEN_QUERY_KEY } from "@/constants/api";
import { useTranslateError } from "@/hooks/use-translate-error";
import { completePasswordSetup, verifyPasswordToken } from "@/lib/api/password-setup";
import { ApiError } from "@/lib/api/errors";
import {
  setPasswordSchema,
  SET_PASSWORD_MISMATCH,
  type SetPasswordValues,
} from "@/lib/validation/set-password";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import type { PasswordTokenCheck } from "@/types/auth";

// Where an emailed link lands. Three states, and the screen has to be honest
// about all of them: checking, a link that no longer works, and the form.

export function SetPasswordForm() {
  const t = useTranslations("auth.setPassword");
  const translateError = useTranslateError();
  const searchParams = useSearchParams();
  const token = searchParams.get(PASSWORD_SETUP_TOKEN_PARAM) ?? "";

  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Checked before anything is typed, so somebody does not choose a password,
  // confirm it, and only then be told the link died three days ago.
  //
  // Never retried: a rejected link is a settled answer, and hammering the
  // redeem endpoint is exactly what its rate limit is there to stop.
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
      // A link can expire between the check above and the submit, so the
      // refusal is shown here too rather than assumed away.
      setFormError(error instanceof ApiError ? error.code : "error.internal");
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="success">{t("successBody")}</Alert>
        <Button asChild className="w-full">
          <Link href="/login">{t("goToLogin")}</Link>
        </Button>
      </div>
    );
  }

  // A link with no token at all — somebody pasted half of it out of their
  // mail client. Worth saying so plainly rather than "expired", which would
  // send them off asking for a replacement they already have.
  if (!token || check.isError) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="destructive">{t(!token ? "missingToken" : "invalidBody")}</Alert>
        <Button asChild variant="outline" className="w-full">
          <Link href="/forgot-password">{t("requestNewLink")}</Link>
        </Button>
      </div>
    );
  }

  if (!check.data) {
    return (
      <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Spinner />
        {t("checking")}
      </p>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {/* method="post" is a fallback only, for the same reason as the login
          form: if this ever submits natively before React hydrates, the
          password goes in the body rather than into the URL and history. */}
      <p className="text-sm text-muted-foreground" dir="ltr">
        {t("forAccount", { email: check.data.email })}
      </p>

      {formError && <Alert variant="destructive">{translateError(formError)}</Alert>}

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("passwordLabel")}</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder={t("passwordPlaceholder")}
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive">
            {translateError(errors.password.message ?? "", { min: PASSWORD_MIN_LENGTH })}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">{t("confirmLabel")}</Label>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          placeholder={t("confirmPlaceholder")}
          aria-invalid={!!errors.confirm}
          {...register("confirm")}
        />
        {errors.confirm && (
          <p className="text-sm text-destructive">
            {errors.confirm.message === SET_PASSWORD_MISMATCH
              ? t("mismatch")
              : translateError(errors.confirm.message ?? "", { min: PASSWORD_MIN_LENGTH })}
          </p>
        )}
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
    </form>
  );
}
