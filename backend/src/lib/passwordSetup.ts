import { emailConfig, sendEmailInBackground } from "@/lib/email";
import { renderPasswordSetupEmail, passwordSetupUrl } from "@/lib/email/templates/passwordSetup";
import { passwordTokens } from "@/lib/passwordTokenStore";
import { loadStoreName, storeNameIn } from "@/lib/storeName";
import type { PasswordTokenPurpose } from "@/types/passwordSetup";

// Issues and emails a password link for all three callers (create user, Admin reset, "I forgot"), so they cannot differ.

export interface PasswordSetupInvite {
  /** The link that was emailed. Returned to Admin-only callers; never logged. */
  url: string;
  expiresAt: Date;
}

/** Stores the hashed token now and mails in the background, so mail never fails the caller; call after commit. */
export async function sendPasswordSetupEmail(
  user: { id: string; name: string; email: string },
  purpose: PasswordTokenPurpose,
): Promise<PasswordSetupInvite> {
  const config = emailConfig();
  const issued = await passwordTokens.issue(user.id, purpose);
  const storeName = storeNameIn(await loadStoreName(), config.defaultLanguage);

  // Written in the store's default language from Settings (rule 14).
  const rendered = renderPasswordSetupEmail({
    language: config.defaultLanguage,
    name: user.name,
    storeName,
    token: issued.token,
    purpose,
    adminUrl: config.adminUrl,
  });

  sendEmailInBackground(
    { to: user.email, subject: rendered.subject, html: rendered.html, text: rendered.text },
    // Enough to find the user in the audit log, never a working link.
    { userId: user.id, purpose },
  );

  return {
    url: passwordSetupUrl({
      adminUrl: config.adminUrl,
      language: config.defaultLanguage,
      token: issued.token,
    }),
    expiresAt: issued.expiresAt,
  };
}
