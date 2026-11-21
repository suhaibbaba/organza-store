"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Alert, Button } from "@store/ui";
import type { User } from "@organza/shared/types/user";
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
    <div className="flex flex-col gap-2 rounded-panel border border-line p-4">
      {pending && <p className="text-label text-ink-muted">{t("pendingHint")}</p>}

      <Button
        type="button"
        variant="secondary"
        className="w-full sm:w-auto sm:self-start"
        isLoading={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? t("sending") : t(pending ? "resendInvite" : "action")}
      </Button>

      {mutation.isError && (
        <Alert tone="danger" data-testid="alert-destructive">
          {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
        </Alert>
      )}

      {mutation.isSuccess && (
        <>
          <Alert tone="success" data-testid="alert-success">
            {t(pending ? "inviteSent" : "sent", { email: mutation.data.email })}
          </Alert>
          <p className="text-label text-ink-muted">{t("linkHint")}</p>
          <p dir="ltr" className="break-all rounded-control bg-inset p-2 text-meta text-ink-muted">
            {mutation.data.url}
          </p>
          <Button
            type="button"
            variant="quiet"
            className="w-full sm:w-auto sm:self-start"
            onClick={() => copyLink(mutation.data.url)}
          >
            {copied ? t("copied") : t("copyLink")}
          </Button>
        </>
      )}
    </div>
  );
}
