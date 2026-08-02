"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { PASSWORD_MIN_LENGTH } from "@shared/constants/validation";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { useTranslateError } from "@/hooks/use-translate-error";
import { loginSchema, type LoginInput } from "@/lib/validation/login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

export function LoginForm() {
  const t = useTranslations("auth.login");
  const translateError = useTranslateError();
  const { login } = useSession();
  const router = useRouter();
  const [formError, setFormError] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginInput) => {
    setFormError(false);
    try {
      await login(values.email, values.password);
      router.replace("/dashboard");
    } catch {
      // Better Auth's sign-in endpoint doesn't use our error-code envelope
      // (see lib/auth/client.ts), so every failure gets the same message.
      setFormError(true);
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
      {formError && <Alert variant="destructive">{t("error")}</Alert>}

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
        <Input
          id="password"
          type="password"
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
