import {
  PASSWORD_SETUP_PATH,
  PASSWORD_SETUP_TOKEN_PARAM,
  PASSWORD_TOKEN_TTL_HOURS,
  type PasswordTokenPurpose,
} from "@shared/constants/passwordSetup";
import { t } from "@/lib/email/i18n";
import { logoUrlFor, renderLayout, renderText } from "@/lib/email/templates/layout";
import type { EmailLayoutInput, RenderedEmail } from "@/types/email";
import type { SupportedLanguage } from "@/types/common";

// "Set your password" and "Reset your password" — one template, because they
// are the same email with a different reason on it, and keeping them together
// is what stops the branding of one drifting away from the other.

const NAMESPACE: Record<PasswordTokenPurpose, string> = {
  SET: "passwordSet",
  RESET: "passwordReset",
};

export interface PasswordSetupEmailInput {
  language: SupportedLanguage;
  /** The person's own name, so the mail is addressed rather than broadcast. */
  name: string;
  token: string;
  purpose: PasswordTokenPurpose;
  /** Origin of the admin app — where the link lands. */
  adminUrl: string;
}

/**
 * The link the button points at. Locale-prefixed because every admin route is
 * (`/ar/set-password?token=…`), and in the recipient's own language: somebody
 * reading an Arabic email should not arrive on an English screen.
 */
export function passwordSetupUrl(input: Pick<PasswordSetupEmailInput, "adminUrl" | "language" | "token">): string {
  const url = new URL(`${input.adminUrl.replace(/\/+$/, "")}/${input.language}/${PASSWORD_SETUP_PATH}`);
  url.searchParams.set(PASSWORD_SETUP_TOKEN_PARAM, input.token);
  return url.toString();
}

export function renderPasswordSetupEmail(input: PasswordSetupEmailInput): RenderedEmail {
  const { language, purpose } = input;
  const ns = NAMESPACE[purpose];
  const url = passwordSetupUrl(input);

  const layout: EmailLayoutInput = {
    language,
    logoUrl: logoUrlFor(input.adminUrl),
    preheader: t(language, `${ns}.preheader`),
    heading: t(language, `${ns}.heading`),
    paragraphs: [t(language, "common.greeting", { name: input.name }), t(language, `${ns}.intro`)],
    action: {
      label: t(language, `${ns}.cta`),
      url,
      fallbackIntro: t(language, "common.buttonFallback"),
      note: t(language, "common.expiry", { hours: PASSWORD_TOKEN_TTL_HOURS[purpose] }),
    },
    footNote: t(language, `${ns}.ignore`),
  };

  return {
    subject: t(language, `${ns}.subject`),
    html: renderLayout(layout),
    text: renderText(layout),
  };
}
