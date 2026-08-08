/**
 * "Email me a link." Reachable without a session, for the obvious reason —
 * somebody who cannot sign in cannot sign in to ask (see src/proxy.ts).
 *
 * The link itself lands on the ADMIN app's set-password screen, because that
 * is the address the backend builds it from (ADMIN_URL). The POS therefore
 * needs the request screen and not the redeem one.
 */
export const FORGOT_PASSWORD_PATH = "/forgot-password";
