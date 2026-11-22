import type { PasskeyFailure } from "@/types/auth";
// /set-password is where the emailed link lands; the path is shared with the backend so they never drift.
export { PASSWORD_SETUP_PATH } from "@store/shared/constants/passwordSetup";

/** "Email me a link." Admin-side only; the backend endpoint behind it is /api/password-setup/request. */
export const FORGOT_PASSWORD_PATH = "/forgot-password";

// What each failed passkey attempt tells the person; a closed prompt says nothing.
export const PASSKEY_ERROR_MESSAGE_KEYS: Record<Exclude<PasskeyFailure, "cancelled">, string> = {
  alreadyAdded: "auth.passkey.alreadyAdded",
  signInAgain: "auth.passkey.signInAgain",
  notOnAccount: "auth.passkey.notOnAccount",
  deactivated: "auth.login.accountDeactivated",
  rateLimited: "auth.login.tooManyAttempts",
  failed: "auth.passkey.failed",
};
