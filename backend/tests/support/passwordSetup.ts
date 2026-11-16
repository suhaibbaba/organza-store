import { PASSWORD_SETUP_TOKEN_PARAM } from "@organza/shared/constants/passwordSetup";

/**
 * Pulls the token out of a set-password link.
 *
 * The Admin-triggered reset endpoint returns the link as well as emailing it
 * (an Admin already holds unrestricted password authority over every account,
 * so it hands them nothing new — see routes/users.ts), and that is what makes
 * the flow testable end to end without a mailbox.
 */
export function tokenFromSetupUrl(url: string): string {
  const token = new URL(url).searchParams.get(PASSWORD_SETUP_TOKEN_PARAM);
  if (!token) throw new Error(`No ${PASSWORD_SETUP_TOKEN_PARAM} in setup URL: ${url}`);
  return token;
}
