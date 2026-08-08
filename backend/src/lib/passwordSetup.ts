import { emailConfig, sendEmailInBackground } from "@/lib/email";
import { renderPasswordSetupEmail, passwordSetupUrl } from "@/lib/email/templates/passwordSetup";
import { passwordTokens } from "@/lib/passwordTokenStore";
import type { PasswordTokenPurpose } from "@/types/passwordSetup";

// Issuing a password link and putting it in the post, in one place, so the
// three callers that need it (creating a user, an Admin triggering a reset,
// and the public "I forgot" endpoint) cannot each get it subtly different.

export interface PasswordSetupInvite {
  /** The link that was emailed. Returned to Admin-only callers; never logged. */
  url: string;
  expiresAt: Date;
}

/**
 * Mint a single-use link for `user` and email it.
 *
 * The token is created and stored (hashed) synchronously — the caller needs
 * to know the link exists — but the MAIL goes out in the background and can
 * never fail the operation that triggered it. Creating a member of staff
 * succeeds even if the mail provider is down; the failure lands in error
 * tracking, and an Admin can trigger another one from the users screen.
 *
 * Call this AFTER the transaction that created or changed the user has
 * committed. Nothing here participates in it.
 */
export async function sendPasswordSetupEmail(
  user: { id: string; name: string; email: string },
  purpose: PasswordTokenPurpose
): Promise<PasswordSetupInvite> {
  const config = emailConfig();
  const issued = await passwordTokens.issue(user.id, purpose);

  // A staff member has no stored language preference — there is no field for
  // one, and the shop runs in one language. So the email is written in the
  // store's default (CLAUDE.md rule 14: read it, never hard-code it).
  const rendered = renderPasswordSetupEmail({
    language: config.defaultLanguage,
    name: user.name,
    token: issued.token,
    purpose,
    adminUrl: config.adminUrl,
  });

  sendEmailInBackground(
    { to: user.email, subject: rendered.subject, html: rendered.html, text: rendered.text },
    // Enough to find the user in the audit log, and nothing that would put a
    // working link into an error report.
    { userId: user.id, purpose }
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
