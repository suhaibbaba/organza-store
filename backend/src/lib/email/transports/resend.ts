import { EMAIL_SEND_TIMEOUT_MS, RESEND_API_URL } from "@/constants/email";
import type { EmailConfig, EmailMessage, EmailTransport } from "@/types/email";

// Resend, over its plain REST endpoint. Deliberately fetch rather than the
// `resend` npm package: the whole surface we use is one POST, and keeping the
// provider out of package.json is what makes "swap it for SMTP later" a new
// file in this folder rather than a dependency removal.
//
// Deliverability rules that are NOT optional for a password link:
//   - no tracking pixel, no rewritten links. Both make a transactional mail
//     look like marketing to the filters, and the link in this one has to
//     arrive.
//   - a reply-to that reaches a human, since the From address does not.

export function createResendTransport(config: EmailConfig): EmailTransport {
  return {
    name: "resend",
    async send(message: EmailMessage): Promise<void> {
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(EMAIL_SEND_TIMEOUT_MS),
      });

      if (!response.ok) {
        // The body carries Resend's own reason (bad key, unverified domain,
        // rejected recipient). It goes to error tracking, never to the caller.
        const detail = await response.text().catch(() => "");
        throw new Error(`Resend rejected the message (HTTP ${response.status}): ${detail}`);
      }
    },
  };
}
