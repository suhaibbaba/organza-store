import type { EmailMessage, EmailTransport } from "@/types/email";

// What a deployment with no RESEND_API_KEY falls back to.
//
// It exists so that a missing key degrades to "the mail was not sent, and the
// log says so" rather than to a crash on the path that created a user — and
// so a developer can run the whole set-password flow locally without a
// provider account.
//
// The subject and the recipient are logged; the BODY is not. The body of this
// particular email contains a working key to somebody's account, and a log
// file is exactly the place it must never appear (spec.md: tokens are never
// logged).
export function createConsoleTransport(): EmailTransport {
  return {
    name: "console",
    async send(message: EmailMessage): Promise<void> {
      console.warn(
        `[email] NOT SENT (no provider configured) — to=${message.to} subject=${JSON.stringify(message.subject)}`
      );
    },
  };
}
