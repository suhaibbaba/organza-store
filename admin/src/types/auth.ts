import type { Role } from "@store/shared/types/role";
import type { SupportedLanguage } from "@store/shared/types/language";
import type { PasswordTokenPurpose } from "@store/shared/constants/passwordSetup";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  // The language chosen on the profile, applied when this person signs in.
  locale?: SupportedLanguage | null;
}

export interface Session {
  user: SessionUser;
  token: string;
}

/** What the API says about an emailed set-password link that has not been used yet. */
export interface PasswordTokenCheck {
  email: string;
  name: string;
  /** SET = a brand-new account choosing its first password; RESET = replacing a forgotten one. */
  purpose: PasswordTokenPurpose;
  expiresAt: string;
}

/** What an Admin gets back after triggering a reset for somebody. */
export interface PasswordResetInvite {
  email: string;
  /** The link that was emailed — shown so it can be passed on by hand when the mailbox is unreachable. */
  url: string;
  expiresAt: string;
}

// Why a passkey sign-in or registration did not finish; "cancelled" is the person closing the prompt and is never shown.
export type PasskeyFailure =
  | "cancelled"
  | "alreadyAdded"
  | "signInAgain"
  | "notOnAccount"
  | "deactivated"
  | "rateLimited"
  | "failed";
