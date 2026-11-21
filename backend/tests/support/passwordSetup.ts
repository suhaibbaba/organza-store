import { PASSWORD_SETUP_TOKEN_PARAM } from "@store/shared/constants/passwordSetup";

/** The token from a set-password link; the Admin reset endpoint returns the link, so no mailbox is needed. */
export function tokenFromSetupUrl(url: string): string {
  const token = new URL(url).searchParams.get(PASSWORD_SETUP_TOKEN_PARAM);
  if (!token) {
    throw new Error(`No ${PASSWORD_SETUP_TOKEN_PARAM} in setup URL: ${url}`);
  }
  return token;
}
