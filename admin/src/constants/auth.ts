// Routes reachable without a session, beyond the login screen itself.
//
// `/set-password` is where an emailed link lands, so its path is the shared
// one the backend builds that link from — the two must never drift apart.
export { PASSWORD_SETUP_PATH } from "@shared/constants/passwordSetup";

/** "Email me a link." Admin-side only; the backend endpoint behind it is /api/password-setup/request. */
export const FORGOT_PASSWORD_PATH = "/forgot-password";
