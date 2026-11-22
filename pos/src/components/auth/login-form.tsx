"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Alert, Button, FormField, Input, PasswordInput, buttonClassName, Icon } from "@store/ui";
import { ACCOUNT_INACTIVE_AUTH_CODE } from "@store/shared/constants/auth";
import { fieldTestSelector, testSelectorFor } from "@store/shared/lib/testSelector";
import { Link, useRouter } from "@/i18n/navigation";
import { SELL_HREF } from "@/constants/profile";
import { useSession } from "@/components/providers/session-provider";
import { usePasskeySignIn } from "@/hooks/use-passkey-sign-in";
import { AuthError } from "@/lib/auth/client";
import { HTTP_TOO_MANY_REQUESTS } from "@/constants/api";
import { FORGOT_PASSWORD_PATH } from "@/constants/auth";
import { fieldErrorKey } from "@/lib/field-error-key";
import { loginSchema, type LoginInput } from "@/lib/validation/login";

// Rate-limited and deactivated are named apart from bad credentials: each sends the person somewhere different.
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
  const { login, hasDevice } = useSession();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const tRoot = useTranslations();
  const passkey = usePasskeySignIn({
    onSignedIn: (user) => router.replace(SELL_HREF, user.locale ? { locale: user.locale } : undefined),
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
      const user = await login(values.email, values.password);
      // The account's own language wins on a shared phone; without one, this device keeps its choice.
      router.replace(SELL_HREF, user.locale ? { locale: user.locale } : undefined);
    } catch (error) {
      // Better Auth's sign-in doesn't use our error envelope (lib/auth/client.ts), so its status and code are read here.
      setFormError(LOGIN_ERROR_MESSAGE_KEYS[loginErrorKind(error)]);
    }
  };

  return (
    // method="post" so a native submit before hydration never puts credentials in the URL.
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {formError && (
        <Alert tone="danger" icon={false} data-testid={testSelectorFor("alert", "destructive")}>
          {tRoot(formError)}
        </Alert>
      )}

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
        <Button type="submit" data-test-selector="pos-login-submit" isLoading={isSubmitting} className="min-w-0 flex-1">
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
            data-test-selector="pos-login-passkey"
            aria-label={t("passkey")}
            title={t("passkey")}
            className="shrink-0 px-0 w-(--control-h)"
          />
        )}
      </div>

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
