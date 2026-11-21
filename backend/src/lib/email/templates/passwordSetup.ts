import {
  PASSWORD_SETUP_PATH,
  PASSWORD_SETUP_TOKEN_PARAM,
  PASSWORD_TOKEN_TTL_HOURS,
  type PasswordTokenPurpose,
} from "@store/shared/constants/passwordSetup";
import { t } from "@/lib/email/i18n";
import { logoUrlFor, renderLayout, renderText } from "@/lib/email/templates/layout";
import type { EmailLayoutInput, RenderedEmail } from "@/types/email";
import type { SupportedLanguage } from "@/types/common";

// Set and reset share one template, so their branding cannot drift apart.

const NAMESPACE: Record<PasswordTokenPurpose, string> = {
  SET: "passwordSet",
  RESET: "passwordReset",
};

export interface PasswordSetupEmailInput {
  language: SupportedLanguage;
  /** The person's own name, so the mail is addressed rather than broadcast. */
  name: string;
  /** The shop's name from Settings, already in `language`. */
  storeName: string;
  token: string;
  purpose: PasswordTokenPurpose;
  /** Origin of the admin app — where the link lands. */
  adminUrl: string;
}

/** The button's link, locale-prefixed like every admin route, in the recipient's language. */
export function passwordSetupUrl(input: Pick<PasswordSetupEmailInput, "adminUrl" | "language" | "token">): string {
  const url = new URL(`${input.adminUrl.replace(/\/+$/, "")}/${input.language}/${PASSWORD_SETUP_PATH}`);
  url.searchParams.set(PASSWORD_SETUP_TOKEN_PARAM, input.token);
  return url.toString();
}

export function renderPasswordSetupEmail(input: PasswordSetupEmailInput): RenderedEmail {
  const { language, purpose, storeName } = input;
  const ns = NAMESPACE[purpose];
  const url = passwordSetupUrl(input);

  const layout: EmailLayoutInput = {
    language,
    storeName,
    logoUrl: logoUrlFor(input.adminUrl),
    preheader: t(language, `${ns}.preheader`),
    heading: t(language, `${ns}.heading`, { storeName }),
    paragraphs: [t(language, "common.greeting", { name: input.name }), t(language, `${ns}.intro`, { storeName })],
    action: {
      label: t(language, `${ns}.cta`),
      url,
      fallbackIntro: t(language, "common.buttonFallback"),
      note: t(language, "common.expiry", { hours: PASSWORD_TOKEN_TTL_HOURS[purpose] }),
    },
    footNote: t(language, `${ns}.ignore`),
  };

  return {
    subject: t(language, `${ns}.subject`, { storeName }),
    html: renderLayout(layout),
    text: renderText(layout),
  };
}
