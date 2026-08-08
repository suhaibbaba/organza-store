import type { SupportedLanguage } from "@/types/common";
import type { EMAIL_TRANSPORTS } from "@/constants/email";

export type EmailTransportName = (typeof EMAIL_TRANSPORTS)[number];

/**
 * One message, provider-agnostic. Every template produces this shape and
 * nothing below it knows what a template is.
 *
 * `text` is not optional: a transactional email without a plain-text
 * alternative reads as bulk mail to every spam filter worth the name, and is
 * the difference between a password link arriving and a password link being
 * quarantined.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

/** What a rendered template hands the service, before the recipient is attached. */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * The swappable half. Resend today; a self-hosted SMTP relay, Postmark, or
 * anything else is one more file implementing this and one line in
 * lib/email/index.ts (CLAUDE.md: keep the provider swappable).
 */
export interface EmailTransport {
  readonly name: EmailTransportName;
  send(message: EmailMessage): Promise<void>;
}

/**
 * Everything the branded shell needs. Templates fill this in; the layout
 * knows nothing about passwords, and this is the seam between them.
 */
export interface EmailLayoutInput {
  language: SupportedLanguage;
  /** Absolute URL of the shop's mark — see lib/email/templates/layout.ts. */
  logoUrl: string;
  /** The line the inbox shows beside the subject. */
  preheader: string;
  heading: string;
  paragraphs: string[];
  action: {
    label: string;
    url: string;
    /** Introduces the raw link, for when the button doesn't work. */
    fallbackIntro: string;
    /** The highlighted line under the button — how long the link lasts, and that it is single-use. */
    note: string;
  };
  /** Optional closing line: "if you didn't ask for this, ignore it." */
  footNote?: string;
}

/** Resolved once from the environment — see lib/email/config.ts. */
export interface EmailConfig {
  transport: EmailTransportName;
  apiKey: string | null;
  from: string;
  replyTo: string | null;
  /** Origin of the admin app, used to build the link inside the email. */
  adminUrl: string;
  /** Which language an email is written in when the recipient has no stated preference. */
  defaultLanguage: SupportedLanguage;
}
