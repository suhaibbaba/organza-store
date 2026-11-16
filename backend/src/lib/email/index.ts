import { captureException } from "@/lib/logger";
import { emailConfig, isEmailConfigured } from "@/lib/email/config";
import { createConsoleTransport } from "@/lib/email/transports/console";
import { createResendTransport } from "@/lib/email/transports/resend";
import type { EmailMessage, EmailTransport } from "@/types/email";

export { emailConfig, isEmailConfigured };

// The email service. One entry point, one swappable transport underneath
// (CLAUDE.md: keep the provider behind an abstraction), and one rule that
// matters more than either:
//
//   SENDING NEVER FAILS THE OPERATION THAT TRIGGERED IT.
//
// Creating a member of staff, resetting a password, anything else that
// notifies: the database write commits first, and the mail goes out after it,
// unawaited. A mail provider that is slow, down, or has had its key rotated
// must not turn "the account was created" into a 500 — the account WAS
// created. Failures go to the error-tracking layer, exactly like a sale
// notification (spec.md "A notification can never cost a sale").

function transportFor(): EmailTransport {
  const config = emailConfig();
  return config.transport === "resend" ? createResendTransport(config) : createConsoleTransport();
}

/**
 * Send and wait. Used by the preview/diagnostic paths and by callers that
 * genuinely want to know — NOT by request handlers. Rejects on failure.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const config = emailConfig();
  await transportFor().send({
    ...message,
    replyTo: message.replyTo ?? config.replyTo ?? undefined,
  });
}

/**
 * Fire and forget. Call this AFTER the transaction has committed; it returns
 * immediately and can never throw into the caller.
 *
 * `context` is attached to the error report so a failure is diagnosable — it
 * must never carry the message body, which for a password email is a working
 * link.
 */
export function sendEmailInBackground(message: EmailMessage, context?: Record<string, unknown>): void {
  void sendEmail(message).catch((error: unknown) => {
    captureException(error, { ...context, emailTo: message.to, emailSubject: message.subject });
  });
}
