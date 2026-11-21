import type { EmailMessage, EmailTransport } from "@/types/email";

// Fallback without RESEND_API_KEY: logs subject and recipient, never the body, which holds a working password link.
export function createConsoleTransport(): EmailTransport {
  return {
    name: "console",
    async send(message: EmailMessage): Promise<void> {
      console.warn(
        `[email] NOT SENT (no provider configured) — to=${message.to} subject=${JSON.stringify(message.subject)}`,
      );
    },
  };
}
