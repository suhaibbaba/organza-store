"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { PASSWORD_MIN_LENGTH } from "@store/shared/constants/validation";
import { Link, useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { AuthError } from "@/lib/auth/client";
import { HTTP_TOO_MANY_REQUESTS } from "@/constants/api";
import { ACCOUNT_INACTIVE_AUTH_CODE } from "@store/shared/constants/auth";
import { FORGOT_PASSWORD_PATH } from "@/constants/auth";
import { useTranslateError } from "@/hooks/use-translate-error";
import { loginSchema, type LoginInput } from "@/lib/validation/login";
import { DEFAULT_LANDING_HREF } from "@/constants/routes";
import { landingHref } from "@/lib/nav";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { Alert, Button, buttonClassName, FormField, Input, PasswordInput } from "@store/ui";
import { AuthFieldError } from "@/components/auth/auth-field-error";

// Rate-limited and deactivated are told apart from bad credentials: each sends the person somewhere different.
type LoginErrorKind = "invalid" | "rateLimited" | "deactivated";

const LOGIN_ERROR_MESSAGE_KEYS: Record<LoginErrorKind, string> = {
  invalid: "error",
  rateLimited: "tooManyAttempts",
  deactivated: "accountDeactivated",
};

function loginErrorKind(error: unknown): LoginErrorKind {
  if (!(error instanceof AuthError)) return "invalid";
  if (error.status === HTTP_TOO_MANY_REQUESTS) return "rateLimited";
  if (error.code === ACCOUNT_INACTIVE_AUTH_CODE) return "deactivated";
  return "invalid";
}


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
      // Landing decided from the signed-in role, so an Employee never passes through a screen they are refused.
      const user = await login(values.email, values.password);
      // The account's own language wins on a shared phone; without one, this device keeps its choice.
      router.replace(landingHref(user) ?? DEFAULT_LANDING_HREF, user.locale ? { locale: user.locale } : undefined);
    } catch (error) {
      // Better Auth's own status/code, not our envelope (lib/auth/client.ts).
      setFormError(loginErrorKind(error));
    }
  };

  return (
    <form
      method="post"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      {/* method="post" is a fallback: a native submit before hydration keeps credentials out of the URL. */}
      {formError && <Alert tone="danger">{t(LOGIN_ERROR_MESSAGE_KEYS[formError])}</Alert>}

      <FormField label="auth.login.emailLabel" htmlFor="email">
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          hasError={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          data-testid={fieldTestSelector("email")}
          {...register("email")}
        />
        {errors.email && <AuthFieldError field="email">{translateError(errors.email.message ?? "")}</AuthFieldError>}
      </FormField>

      <FormField label="auth.login.passwordLabel" htmlFor="password">
        <PasswordInput
          id="password"
          autoComplete="current-password"
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

      <Button
        type="submit"
        data-test-selector="login-submit"
        isLoading={isSubmitting}
        className="mt-2 w-full"
      >
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>

      {/* Self-service reset by email, so nobody has to catch an Admin to get back in. */}
      <Link href={FORGOT_PASSWORD_PATH} className={buttonClassName({ variant: "quiet", className: "w-full" })}>
        {tForgot("link")}
      </Link>
    </form>
  );
}
