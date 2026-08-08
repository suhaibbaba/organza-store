import type { PasswordTokenPurpose } from "@shared/constants/passwordSetup";

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
