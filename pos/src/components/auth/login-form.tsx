"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Alert, Button, FormField, Input, PasswordInput, buttonClassName } from "@store/ui";
import { PASSWORD_MIN_LENGTH } from "@store/shared/constants/validation";
import { ACCOUNT_INACTIVE_AUTH_CODE } from "@store/shared/constants/auth";
import { fieldErrorTestSelector, fieldTestSelector, testSelectorFor } from "@store/shared/lib/testSelector";
import { Link, useRouter } from "@/i18n/navigation";
import { SELL_HREF } from "@/constants/profile";
import { useSession } from "@/components/providers/session-provider";
import { AuthError } from "@/lib/auth/client";
import { HTTP_TOO_MANY_REQUESTS } from "@/constants/api";
import { FORGOT_PASSWORD_PATH } from "@/constants/auth";
import { useTranslateError } from "@/hooks/use-translate-error";
import { loginSchema, type LoginInput } from "@/lib/validation/login";

// Rate-limited and deactivated are named apart from bad credentials: each sends the person somewhere different.
type LoginErrorKind = "invalid" | "rateLimited" | "deactivated";

const LOGIN_ERROR_MESSAGE_KEYS: Record<LoginErrorKind, string> = {
  invalid: "error",
  rateLimited: "tooManyAttempts",
  deactivated: "accountDeactivated",
};

function loginErrorKind(error: unknown): LoginErrorKind {
  if (!(error instanceof AuthError)) {
    return "invalid";
  }
  if (error.status === HTTP_TOO_MANY_REQUESTS) {
    return "rateLimited";
  }
  if (error.code === ACCOUNT_INACTIVE_AUTH_CODE) {
    return "deactivated";
  }
  return "invalid";
}

export function LoginForm() {
  const t = useTranslations("auth.login");
  const tForgot = useTranslations("auth.forgotPassword");
  const translateError = useTranslateError();
  const { login, hasDevice } = useSession();
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
      const user = await login(values.email, values.password);
      // The account's own language wins on a shared phone; without one, this device keeps its choice.
      router.replace(SELL_HREF, user.locale ? { locale: user.locale } : undefined);
    } catch (error) {
      // Better Auth's sign-in doesn't use our error envelope (lib/auth/client.ts), so its status and code are read here.
      setFormError(loginErrorKind(error));
    }
  };

  return (
    // method="post" so a native submit before hydration never puts credentials in the URL.
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className={"flex flex-col gap-5"}>
      {formError && (
        <Alert tone="danger" icon={false} data-testid={testSelectorFor("alert", "destructive")}>
          {t(LOGIN_ERROR_MESSAGE_KEYS[formError])}
        </Alert>
      )}

      <FormField label="auth.login.emailLabel" required htmlFor="email">
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          hasError={!!errors.email}
          data-testid={fieldTestSelector("email")}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-meta text-danger-600" role="alert" data-test-selector={fieldErrorTestSelector("email")}>
            {translateError(errors.email.message ?? "")}
          </p>
        )}
      </FormField>

      <FormField label="auth.login.passwordLabel" required htmlFor="password">
        <PasswordInput
          id="password"
          autoComplete="current-password"
          placeholder={t("passwordPlaceholder")}
          hasError={!!errors.password}
          data-testid={fieldTestSelector("password")}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-meta text-danger-600" role="alert" data-test-selector={fieldErrorTestSelector("password")}>
            {translateError(errors.password.message ?? "", { min: PASSWORD_MIN_LENGTH })}
          </p>
        )}
      </FormField>

      <Button type="submit" data-test-selector="pos-login-submit" isLoading={isSubmitting} className="mt-2 w-full">
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>

      {/* Back to the people on this tablet, for whoever came here by mistake. */}
      {hasDevice && (
        <Link
          href={SELL_HREF}
          className={buttonClassName({ variant: "secondary", className: "w-full" })}
          data-test-selector="pos-login-use-passcode"
        >
          {t("usePasscode")}
        </Link>
      )}

      {/* Resets are self-service by email, so a cashier locked out at the till needn't find an Admin first. */}
      <Link href={FORGOT_PASSWORD_PATH} className={buttonClassName({ variant: "quiet", className: "w-full" })}>
        {tForgot("link")}
      </Link>
    </form>
  );
}
