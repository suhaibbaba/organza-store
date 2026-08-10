"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { PASSWORD_MIN_LENGTH } from "@organza/shared/constants/validation";
import { Link, useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { AuthError } from "@/lib/auth/client";
import { HTTP_TOO_MANY_REQUESTS } from "@/constants/api";
import { FORGOT_PASSWORD_PATH } from "@/constants/auth";
import { useTranslateError } from "@/hooks/use-translate-error";
import { loginSchema, type LoginInput } from "@/lib/validation/login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

// Which of the two failures to name. Anything that is not the rate limit is
// reported as bad credentials, because that is all the endpoint tells us.
type LoginErrorKind = "invalid" | "rateLimited";

export function LoginForm() {
  const t = useTranslations("auth.login");
  const tForgot = useTranslations("auth.forgotPassword");
  const translateError = useTranslateError();
  const { login } = useSession();
  const router = useRouter();
  const [formError, setFormError] = useState<LoginErrorKind | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginInput) => {
    setFormError(null);
    try {
      await login(values.email, values.password);
      router.replace("/dashboard");
    } catch (error) {
      // Better Auth's sign-in endpoint doesn't use our error-code envelope
      // (see lib/auth/client.ts), so there is no code to translate — but the
      // STATUS still tells the two failures that matter apart. A 429 is
      // "you have tried too often", and saying "wrong password" to that is
      // how a password somebody has just set appears not to work.
      setFormError(
        error instanceof AuthError && error.status === HTTP_TOO_MANY_REQUESTS ? "rateLimited" : "invalid"
      );
    }
  };

  return (
    <form
      method="post"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      {/* method="post" is a fallback only: if this ever submits natively
          before React hydrates, credentials go in the request body instead
          of leaking into the URL/history the way a default GET would. */}
      {formError && <Alert variant="destructive">{t(formError === "rateLimited" ? "tooManyAttempts" : "error")}</Alert>}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("emailLabel")}</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{translateError(errors.email.message ?? "")}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("passwordLabel")}</Label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
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

      <Button type="submit" disabled={isSubmitting} className="mt-2 w-full sm:w-auto sm:self-start">
        {isSubmitting ? (
          <>
            <Spinner />
            {t("submitting")}
          </>
        ) : (
          t("submit")
        )}
      </Button>

      {/* Password resets are self-service by email now (spec.md "Auth
          (details)"), so nobody has to catch an Admin to get back in. */}
      <Button asChild variant="ghost" className="w-full sm:w-auto sm:self-start">
        <Link href={FORGOT_PASSWORD_PATH}>{tForgot("link")}</Link>
      </Button>
    </form>
  );
}
