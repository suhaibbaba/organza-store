import "dotenv/config";
import { DEFAULT_EMAIL_FROM } from "@/constants/email";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "@organza/shared/constants/languages";
import type { EmailConfig, EmailTransportName } from "@/types/email";
import type { SupportedLanguage } from "@/types/common";

// Read at call time, not at import time, so a preview script or a test can
// set the environment and get the answer it just wrote.

function trimmed(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function resolveLanguage(): SupportedLanguage {
  const configured = trimmed("DEFAULT_LANGUAGE");
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(configured ?? "")
    ? (configured as SupportedLanguage)
    : DEFAULT_LANGUAGE;
}

/**
 * Where the emailed link points. The admin app is the only place a password
 * can be set, so this is its public origin — falling back to the auth URL,
 * which on a single-host development machine is the same thing.
 */
function resolveAdminUrl(): string {
  const url = trimmed("ADMIN_URL") ?? trimmed("BETTER_AUTH_URL") ?? "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

export function emailConfig(): EmailConfig {
  const apiKey = trimmed("RESEND_API_KEY");
  // No key, no provider: the console transport keeps the flow working end to
  // end on a developer's machine and makes a misconfigured deployment
  // obvious in `docker compose logs` instead of silently swallowing mail.
  const transport: EmailTransportName = apiKey ? "resend" : "console";

  return {
    transport,
    apiKey,
    from: trimmed("EMAIL_FROM") ?? DEFAULT_EMAIL_FROM,
    // Replies to a transactional email are a person trying to reach the shop
    // — they must not land in a mailbox nobody reads.
    replyTo: trimmed("EMAIL_REPLY_TO"),
    adminUrl: resolveAdminUrl(),
    defaultLanguage: resolveLanguage(),
  };
}

/** Whether mail will actually leave the building. Used by health/debug output and by tests. */
export function isEmailConfigured(): boolean {
  return emailConfig().transport !== "console";
}
