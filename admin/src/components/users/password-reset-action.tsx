"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { User } from "@shared/types/user";
import { useTranslateError } from "@/hooks/use-translate-error";
import { resendUserInvite, sendUserPasswordReset } from "@/lib/api/password-setup";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

// "Send this person a set-password link", from the staff sheet.
//
// This is what an Admin reaches for instead of typing a password into the box
// above and reading it out: the link goes to the person's own mailbox and only
// they ever know what they choose. The link is shown here as well, because a
// mailbox that bounces is a real thing in this shop and passing it on over
// WhatsApp has to be possible — it works exactly once either way.
//
// Which of the two it sends depends on where this person has got to, because
// they are genuinely different things to say. Somebody who has never chosen a
// password is still being INVITED — their link lasts 72 hours and the mail
// says "choose your password" — and the button says "send the invitation
// again". Somebody who already has one is being RESET, in two hours, and the
// button says so. The backend enforces the same split (it refuses a resend
// for an account that has a password), so the wording on the button can never
// be a lie about what happened.
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
      // Clipboard access can be refused (an insecure origin, a locked-down
      // browser). The link is on screen and selectable regardless.
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
      {pending && <p className="text-sm text-muted-foreground">{t("pendingHint")}</p>}

      {/* type="button": this sits inside the staff <form>, and a bare button
          there would submit it. */}
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto sm:self-start"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? (
          <>
            <Spinner />
            {t("sending")}
          </>
        ) : (
          t(pending ? "resendInvite" : "action")
        )}
      </Button>

      {mutation.isError && (
        <Alert variant="destructive">
          {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
        </Alert>
      )}

      {mutation.isSuccess && (
        <>
          <Alert variant="success">{t(pending ? "inviteSent" : "sent", { email: mutation.data.email })}</Alert>
          <p className="text-sm text-muted-foreground">{t("linkHint")}</p>
          <p dir="ltr" className="break-all rounded-md bg-muted p-2 text-xs text-muted-foreground">
            {mutation.data.url}
          </p>
          <Button type="button" variant="ghost" className="w-full sm:w-auto sm:self-start" onClick={() => copyLink(mutation.data.url)}>
            {copied ? t("copied") : t("copyLink")}
          </Button>
        </>
      )}
    </div>
  );
}
