"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { usePasskeySignIn } from "@/hooks/use-passkey-sign-in";
import { AuthError } from "@/lib/auth/client";
import { HTTP_TOO_MANY_REQUESTS } from "@/constants/api";
import { ACCOUNT_INACTIVE_AUTH_CODE } from "@store/shared/constants/auth";
import { FORGOT_PASSWORD_PATH } from "@/constants/auth";
import { loginSchema, type LoginInput } from "@/lib/validation/login";
import { DEFAULT_LANDING_HREF } from "@/constants/routes";
import { landingHref } from "@/lib/nav";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { Alert, Button, buttonClassName, FormField, Input, PasswordInput, Icon } from "@store/ui";
import { fieldErrorKey } from "@/lib/field-error-key";

// Rate-limited and deactivated are told apart from bad credentials: each sends the person somewhere different.
type LoginErrorKind = "invalid" | "rateLimited" | "deactivated";

const LOGIN_ERROR_MESSAGE_KEYS: Record<LoginErrorKind, string> = {
  invalid: "auth.login.error",
  rateLimited: "auth.login.tooManyAttempts",
  deactivated: "auth.login.accountDeactivated",
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
  const { login } = useSession();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const tRoot = useTranslations();
  const passkey = usePasskeySignIn({
    onSignedIn: (user) =>
      router.replace(landingHref(user) ?? DEFAULT_LANDING_HREF, user.locale ? { locale: user.locale } : undefined),
    onMessage: setFormError,
  });

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
      setFormError(LOGIN_ERROR_MESSAGE_KEYS[loginErrorKind(error)]);
    }
  };

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {/* method="post" is a fallback: a native submit before hydration keeps credentials out of the URL. */}
      {formError && <Alert tone="danger">{tRoot(formError)}</Alert>}

      <FormField
        label="auth.login.emailLabel"
        required
        htmlFor="email"
        error={errors.email}
        errorKey={fieldErrorKey(errors.email)}
      >
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email webauthn"
          placeholder={t("emailPlaceholder")}
          hasError={!!errors.email}
          data-testid={fieldTestSelector("email")}
          {...register("email")}
        />
      </FormField>

      <FormField
        label="auth.login.passwordLabel"
        required
        htmlFor="password"
        error={errors.password}
        errorKey={fieldErrorKey(errors.password)}
      >
        <PasswordInput
          id="password"
          autoComplete="current-password"
          placeholder={t("passwordPlaceholder")}
          hasError={!!errors.password}
          data-testid={fieldTestSelector("password")}
          {...register("password")}
        />
      </FormField>

      {/* The passkey sits beside sign-in as an icon: the form stays the main way in. */}
      <div className="flex gap-2">
        <Button type="submit" data-test-selector="login-submit" isLoading={isSubmitting} className="min-w-0 flex-1">
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
        {passkey.available && (
          <Button
            type="button"
            variant="secondary"
            icon={<Icon name="passkey" aria-hidden="true" />}
            isLoading={passkey.pending}
            disabled={isSubmitting}
            onClick={() => void passkey.signIn()}
            data-test-selector="login-passkey"
            aria-label={t("passkey")}
            title={t("passkey")}
            className="shrink-0 px-0 w-(--control-h)"
          />
        )}
      </div>

      {/* Self-service reset by email, so nobody has to catch an Admin to get back in. */}
      <Link href={FORGOT_PASSWORD_PATH} className={buttonClassName({ variant: "quiet", className: "w-full" })}>
        {tForgot("link")}
      </Link>
    </form>
  );
}
