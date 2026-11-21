// /set-password is where the emailed link lands; the path is shared with the backend so they never drift.
export { PASSWORD_SETUP_PATH } from "@store/shared/constants/passwordSetup";

/** "Email me a link." Admin-side only; the backend endpoint behind it is /api/password-setup/request. */
export const FORGOT_PASSWORD_PATH = "/forgot-password";
