"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Alert, Button, Typography } from "@store/ui";
import type { User } from "@store/shared/types/user";
import { useTranslateError } from "@/hooks/use-translate-error";
import { resendUserInvite, sendUserPasswordReset } from "@/lib/api/password-setup";
import { ApiError } from "@/lib/api/errors";

// Never-set-a-password accounts get the 72h invitation again, others a 2h reset; the backend enforces the same split.
export function PasswordResetAction({ user }: { user: User }) {
  const t = useTranslations("users.passwordReset");
  const translateError = useTranslateError();
  const [copied, setCopied] = useState(false);
  const pending = !user.hasPassword;

  const mutation = useMutation({
    mutationFn: () => (pending ? resendUserInvite(user.id) : sendUserPasswordReset(user.id)),
  });

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-panel bg-sunken p-4" data-test-selector="user-password-link">
      <Typography variant="small" tone="muted">
        {t(pending ? "pendingHint" : "hint")}
      </Typography>

      <Button
        type="button"
        variant="secondary"
        className="self-start"
        isLoading={mutation.isPending}
        onClick={() => mutation.mutate()}
        data-test-selector="user-password-link-send"
      >
        {t(pending ? "resendInvite" : "action")}
      </Button>

      {mutation.isError && (
        <Alert tone="danger" data-testid="user-password-link-error">
          {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
        </Alert>
      )}

      {mutation.isSuccess && (
        <div className="flex flex-col gap-2">
          <Alert tone="success" data-testid="user-password-link-sent">
            {t(pending ? "inviteSent" : "sent", { email: mutation.data.email })}
          </Alert>
          <Typography variant="small" tone="muted">
            {t("linkHint")}
          </Typography>
          <Typography variant="small" as="p" dir="ltr" className="break-all rounded-control bg-surface p-2 text-start">
            {mutation.data.url}
          </Typography>
          <Button type="button" variant="quiet" className="self-start" onClick={() => void copyLink(mutation.data.url)}>
            {copied ? t("copied") : t("copyLink")}
          </Button>
        </div>
      )}
    </div>
  );
}
