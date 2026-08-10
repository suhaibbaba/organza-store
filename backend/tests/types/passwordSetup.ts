import type { PasswordTokenPurpose } from "@organza/shared/constants/passwordSetup";
import type { SerializableUser } from "@/types";

/**
 * A staff row as the API returns it: the user PLUS whether the account has
 * ever been finished off.
 *
 * `hasPassword` is what tells "invited, waiting on their link" apart from
 * "signed in and working" — the two are otherwise identical on the wire, and
 * both are `isActive: true`.
 */
export interface StaffAccountView extends SerializableUser {
  hasPassword: boolean;
}

/** POST /api/users/:id/password-reset */
export interface PasswordResetInvite {
  email: string;
  url: string;
  expiresAt: string;
}

/** POST /api/password-setup/verify */
export interface PasswordTokenCheck {
  email: string;
  name: string;
  purpose: PasswordTokenPurpose;
  expiresAt: string;
}
