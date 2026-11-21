import "dotenv/config";
import { DEFAULT_EMAIL_FROM } from "@/constants/email";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "@store/shared/constants/languages";
import type { EmailConfig, EmailTransportName } from "@/types/email";
import type { SupportedLanguage } from "@/types/common";

// Read at call time, so a preview script or test can set the environment first.

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

/** Where the emailed link points: the admin's public origin, falling back to the auth URL. */
function resolveAdminUrl(): string {
  const url = trimmed("ADMIN_URL") ?? trimmed("BETTER_AUTH_URL") ?? "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

export function emailConfig(): EmailConfig {
  const apiKey = trimmed("RESEND_API_KEY");
  // No key, console transport: the flow works locally and a misconfigured deployment shows in the logs.
  const transport: EmailTransportName = apiKey ? "resend" : "console";

  return {
    transport,
    apiKey,
    from: trimmed("EMAIL_FROM") ?? DEFAULT_EMAIL_FROM,
    // Replies are a person trying to reach the shop, so they must reach a mailbox somebody reads.
    replyTo: trimmed("EMAIL_REPLY_TO"),
    adminUrl: resolveAdminUrl(),
    defaultLanguage: resolveLanguage(),
  };
}

/** Whether mail will actually leave the building. Used by health/debug output and by tests. */
export function isEmailConfigured(): boolean {
  return emailConfig().transport !== "console";
}
